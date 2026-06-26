// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import {
  sendAppointmentConfirmationEmail,
  sendAppointmentReminderEmail,
} from "@/lib/email/resend";
import { formatReminderLabel } from "@/lib/email/reminder-label";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

/** Sends a test email to the doctor or resends a confirmation to a patient. */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  const body = await request.json();
  const { action, appointmentId, accessToken } = body as {
    action: "testReminder" | "resendConfirmation";
    appointmentId?: string;
    accessToken?: string;
  };

  if (action === "testReminder") {
    if (user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json({ error: "Solo médicos" }, { status: 403 });
    }

    const { data: professional } = await supabase
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

    const sendResult = await sendAppointmentReminderEmail({
      patientEmail: professional.email,
      patientName: professional.full_name,
      doctorName: professional.full_name,
      scheduledAt: format(
        new Date(Date.now() + (settings?.minutesBefore ?? 1440) * 60 * 1000),
        "EEEE d 'de' MMMM 'a las' HH:mm 'hs'",
        { locale: es },
      ),
      waitingRoomUrl: `${baseUrl()}/medico/dashboard`,
    });

    if (sendResult.mock) {
      return NextResponse.json({
        ok: true,
        mock: true,
        message: `Modo demo: no hay RESEND_API_KEY en Vercel. Configurá RESEND_API_KEY y RESEND_FROM_EMAIL (dominio verificado) para enviar a ${professional.email}.`,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Email de prueba enviado a ${professional.email} (simula aviso ${label})`,
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
      supabase.from("professionals").select("*, office_settings(*)").eq("id", apt.doctor_id).maybeSingle(),
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
    const reminderSettings = (professional as any).office_settings?.reminder_settings;
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
      waitingRoomUrl: `${baseUrl()}/paciente/sala/${apt.access_token}`,
      reminderNote,
    });

    return NextResponse.json({
      ok: true,
      message: `Confirmación reenviada a ${patient.email}`,
    });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
