import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import {
  sendAppointmentConfirmationEmail,
  sendAppointmentReminderEmail,
} from "@/lib/email/resend";
import { formatReminderLabel } from "@/lib/email/reminder-label";
import {
  getReminderTestEmail,
  REMINDER_TEST_PATIENT_NAME,
} from "@/lib/email/reminder-test-email";
import { appBaseUrl as baseUrl, patientLoginUrl } from "@/lib/clinic/appointment-payment";
import { isLocalMode } from "@/lib/clinic/config";
import { readDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const DOCTOR_ROLES = new Set([
  "doctor",
  "admin",
  "super_admin",
  "medico",
  "agent",
]);

/** Sends a test reminder to REMINDER_TEST_EMAIL or resends a confirmation to a patient. */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, appointmentId, accessToken } = body as {
    action: "testReminder" | "resendConfirmation";
    appointmentId?: string;
    accessToken?: string;
  };

  if (isLocalMode()) {
    return handleLocalReminders(request, action, appointmentId, accessToken);
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  if (action === "testReminder") {
    if (!DOCTOR_ROLES.has(user.role)) {
      return NextResponse.json({ error: "Solo médicos" }, { status: 403 });
    }

    const me = await resolveProfessional(authResult);
    const { data: professional } = me
      ? await supabase
          .from("professionals")
          .select("*, office_settings(*)")
          .eq("id", me.id)
          .maybeSingle()
      : await supabase
          .from("professionals")
          .select("*, office_settings(*)")
          .eq("user_id", user.id)
          .maybeSingle();

    if (!professional) {
      return NextResponse.json(
        { error: "Médico no encontrado" },
        { status: 404 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const officeSettings = (professional as any).office_settings;
    const settings = officeSettings?.reminder_settings;
    const label = formatReminderLabel(settings?.minutesBefore ?? 1440);
    const toEmail = getReminderTestEmail();
    if (!toEmail) {
      return NextResponse.json(
        {
          error:
            "Configurá REMINDER_TEST_EMAIL en nodo-clinica/.env.local para enviar la prueba.",
        },
        { status: 400 },
      );
    }

    const sendResult = await sendAppointmentReminderEmail({
      patientEmail: toEmail,
      patientName: REMINDER_TEST_PATIENT_NAME,
      doctorName: professional.full_name,
      scheduledAt: format(
        new Date(Date.now() + (settings?.minutesBefore ?? 1440) * 60 * 1000),
        "EEEE d 'de' MMMM 'a las' HH:mm 'hs'",
        { locale: es },
      ),
      waitingRoomUrl: patientLoginUrl(baseUrl()),
    });

    if (sendResult.mock) {
      return NextResponse.json({
        ok: true,
        mock: true,
        message: `Modo demo: configurá ZOHO_SMTP_USER y ZOHO_SMTP_PASSWORD para enviar a ${toEmail}.`,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Email de prueba enviado a ${toEmail} (simula aviso ${label})`,
      emailId: sendResult.id,
    });
  }

  if (action === "resendConfirmation") {
    const { data: apt } = appointmentId
      ? await supabase
          .from("appointments")
          .select("*")
          .eq("id", appointmentId)
          .maybeSingle()
      : await supabase
          .from("appointments")
          .select("*")
          .eq("access_token", accessToken ?? "")
          .maybeSingle();

    if (!apt) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 },
      );
    }

    if (user.role === "patient") {
      const { data: patientRow } = await supabase
        .from("patients")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (patientRow && patientRow.id !== apt.patient_id) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    const [{ data: patient }, { data: professional }] = await Promise.all([
      supabase.from("patients").select("*").eq("id", apt.patient_id).maybeSingle(),
      supabase
        .from("professionals")
        .select("*, office_settings(*)")
        .eq("id", apt.doctor_id)
        .maybeSingle(),
    ]);

    if (!patient || !professional) {
      return NextResponse.json(
        { error: "Datos incompletos" },
        { status: 404 },
      );
    }

    const scheduledLabel = format(
      new Date(apt.scheduled_at),
      "EEEE d 'de' MMMM 'a las' HH:mm 'hs'",
      { locale: es },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reminderSettings = (professional as any).office_settings
      ?.reminder_settings;
    let reminderNote: string | undefined;
    if (reminderSettings?.enabled) {
      reminderNote = `Te enviaremos un recordatorio ${formatReminderLabel(
        reminderSettings.minutesBefore ?? 1440,
      )} del turno a ${patient.email}.`;
    }

    await sendAppointmentConfirmationEmail({
      patientEmail: patient.email,
      patientName: patient.full_name,
      doctorName: professional.full_name,
      scheduledAt: scheduledLabel,
      waitingRoomUrl: patientLoginUrl(baseUrl()),
      reminderNote,
    });

    return NextResponse.json({
      ok: true,
      message: `Confirmación reenviada a ${patient.email}`,
    });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}

async function handleLocalReminders(
  request: NextRequest,
  action: string,
  appointmentId?: string,
  accessToken?: string,
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = await readDb();

  if (action === "testReminder") {
    if (!DOCTOR_ROLES.has(session.role)) {
      return NextResponse.json({ error: "Solo médicos" }, { status: 403 });
    }

    const doctor = db.doctors.find((d) => d.id === session.userId);
    if (!doctor) {
      return NextResponse.json(
        { error: "Médico no encontrado" },
        { status: 404 },
      );
    }

    const settings = doctor.reminderSettings;
    const label = formatReminderLabel(settings?.minutesBefore ?? 1440);
    const toEmail = getReminderTestEmail();
    if (!toEmail) {
      return NextResponse.json(
        {
          error:
            "Configurá REMINDER_TEST_EMAIL en nodo-clinica/.env.local para enviar la prueba.",
        },
        { status: 400 },
      );
    }

    const sendResult = await sendAppointmentReminderEmail({
      patientEmail: toEmail,
      patientName: REMINDER_TEST_PATIENT_NAME,
      doctorName: doctor.fullName,
      scheduledAt: format(
        new Date(Date.now() + (settings?.minutesBefore ?? 1440) * 60 * 1000),
        "EEEE d 'de' MMMM 'a las' HH:mm 'hs'",
        { locale: es },
      ),
      waitingRoomUrl: patientLoginUrl(baseUrl()),
    });

    if (sendResult.mock) {
      return NextResponse.json({
        ok: true,
        mock: true,
        message: `Modo demo: falta ZOHO_SMTP_USER / ZOHO_SMTP_PASSWORD en .env.local. Sin eso no se envía a ${toEmail}.`,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Email de prueba enviado a ${toEmail} (simula aviso ${label})`,
      emailId: sendResult.id,
    });
  }

  if (action === "resendConfirmation") {
    const apt = appointmentId
      ? db.appointments.find((a) => a.id === appointmentId)
      : db.appointments.find((a) => a.accessToken === accessToken);

    if (!apt) {
      return NextResponse.json(
        { error: "Turno no encontrado" },
        { status: 404 },
      );
    }

    if (session.role === "patient" && session.userId !== apt.patientId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const patient = db.patients.find((p) => p.id === apt.patientId);
    const doctor = db.doctors.find((d) => d.id === apt.doctorId);
    if (!patient || !doctor) {
      return NextResponse.json(
        { error: "Datos incompletos" },
        { status: 404 },
      );
    }

    const scheduledLabel = format(
      new Date(apt.scheduledAt),
      "EEEE d 'de' MMMM 'a las' HH:mm 'hs'",
      { locale: es },
    );

    let reminderNote: string | undefined;
    if (doctor.reminderSettings?.enabled) {
      reminderNote = `Te enviaremos un recordatorio ${formatReminderLabel(
        doctor.reminderSettings.minutesBefore ?? 1440,
      )} del turno a ${patient.email}.`;
    }

    const toEmail = patient.email;
    const sendResult = await sendAppointmentConfirmationEmail({
      patientEmail: toEmail,
      patientName: patient.fullName,
      doctorName: doctor.fullName,
      scheduledAt: scheduledLabel,
      waitingRoomUrl: patientLoginUrl(baseUrl()),
      reminderNote,
    });

    if (sendResult.mock) {
      return NextResponse.json({
        ok: true,
        mock: true,
        message: `Modo demo: falta ZOHO_SMTP_USER / ZOHO_SMTP_PASSWORD. No se envió a ${toEmail}.`,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Confirmación enviada a ${toEmail}`,
      emailId: sendResult.id,
    });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
