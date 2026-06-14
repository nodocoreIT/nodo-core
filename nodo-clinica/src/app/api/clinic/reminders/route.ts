import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
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

/** Envía email de prueba al médico o reenvía confirmación al paciente. */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { action, appointmentId, accessToken } = body as {
    action: "testReminder" | "resendConfirmation";
    appointmentId?: string;
    accessToken?: string;
  };

  const db = await readDb();

  if (action === "testReminder") {
    if (session.role !== "doctor") {
      return NextResponse.json({ error: "Solo médicos" }, { status: 403 });
    }
    const doctor = db.doctors.find((d) => d.id === session.userId);
    if (!doctor) {
      return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
    }

    const settings = doctor.reminderSettings;
    const label = formatReminderLabel(settings?.minutesBefore ?? 1440);

    await sendAppointmentReminderEmail({
      patientEmail: doctor.email,
      patientName: doctor.fullName,
      doctorName: doctor.fullName,
      scheduledAt: format(
        new Date(Date.now() + (settings?.minutesBefore ?? 1440) * 60 * 1000),
        "EEEE d 'de' MMMM 'a las' HH:mm 'hs'",
        { locale: es }
      ),
      waitingRoomUrl: `${baseUrl()}/medico/dashboard`,
    });

    return NextResponse.json({
      ok: true,
      message: `Email de prueba enviado a ${doctor.email} (simula aviso ${label})`,
    });
  }

  if (action === "resendConfirmation") {
    const apt = appointmentId
      ? db.appointments.find((a) => a.id === appointmentId)
      : db.appointments.find((a) => a.accessToken === accessToken);

    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }

    if (session.role === "patient" && session.userId !== apt.patientId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const patient = db.patients.find((p) => p.id === apt.patientId);
    const doctor = db.doctors.find((d) => d.id === apt.doctorId);
    if (!patient || !doctor) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 404 });
    }

    const scheduledLabel = format(
      new Date(apt.scheduledAt),
      "EEEE d 'de' MMMM 'a las' HH:mm 'hs'",
      { locale: es }
    );

    let reminderNote: string | undefined;
    if (doctor.reminderSettings?.enabled) {
      reminderNote = `Te enviaremos un recordatorio ${formatReminderLabel(
        doctor.reminderSettings.minutesBefore ?? 1440
      )} del turno a ${patient.email}.`;
    }

    await sendAppointmentConfirmationEmail({
      patientEmail: patient.email,
      patientName: patient.fullName,
      doctorName: doctor.fullName,
      scheduledAt: scheduledLabel,
      waitingRoomUrl: `${baseUrl()}/paciente/sala/${apt.accessToken}`,
      reminderNote,
    });

    return NextResponse.json({
      ok: true,
      message: `Confirmación reenviada a ${patient.email}`,
    });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
