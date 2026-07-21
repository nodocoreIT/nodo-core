import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isPaymentConfirmed } from "@/lib/clinic/payment";
import { sendAppointmentReminderEmail } from "@/lib/email/resend";
import { appBaseUrl } from "@/lib/clinic/appointment-payment";
import { isLocalMode } from "@/lib/clinic/config";
import { readDb, writeDb } from "@/lib/clinic/local-db";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  if (isLocalMode()) {
    return runLocalReminders();
  }

  const supabase = await createServiceClient();
  const now = Date.now();
  /** Hobby tier: cron runs once/day; send if already past reminder time (up to 36 h tolerance). */
  const maxLatenessMs = 36 * 60 * 60 * 1000;
  let sent = 0;

  const baseUrl = appBaseUrl();

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "*, patients(email, full_name), professionals!appointments_doctor_id_fkey(full_name, office_settings(reminder_settings))",
    )
    .in("status", ["scheduled", "waiting"])
    .is("reminder_sent_at", null);

  for (const apt of appointments ?? []) {
    if (!isPaymentConfirmed(apt as never)) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const professional = (apt as any).professionals;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patient = (apt as any).patients;
    if (!professional || !patient) continue;

    const settings = professional.office_settings?.reminder_settings;
    if (!settings?.enabled) continue;

    const minutesBefore = settings.minutesBefore ?? 1440;
    const scheduledMs = new Date(apt.scheduled_at).getTime();
    const remindAt = scheduledMs - minutesBefore * 60 * 1000;

    if (now < remindAt) continue;
    if (now - remindAt > maxLatenessMs) continue;
    if (now >= scheduledMs) continue;

    const scheduledLabel = format(
      new Date(apt.scheduled_at),
      "EEEE d 'de' MMMM 'a las' HH:mm 'hs'",
      { locale: es },
    );

    try {
      await sendAppointmentReminderEmail({
        patientEmail: patient.email,
        patientName: patient.full_name,
        doctorName: professional.full_name,
        scheduledAt: scheduledLabel,
        waitingRoomUrl: `${baseUrl}/paciente/sala/${apt.access_token}`,
      });

      await supabase
        .from("appointments")
        .update({
          reminder_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", apt.id);

      sent++;
    } catch (err) {
      console.error("[Reminder] failed for", apt.id, err);
    }
  }

  return NextResponse.json({ ok: true, sent });
}

async function runLocalReminders() {
  const now = Date.now();
  const maxLatenessMs = 36 * 60 * 60 * 1000;
  const baseUrl = appBaseUrl();
  const override = process.env.REMINDER_TEST_EMAIL?.trim();
  let sent = 0;
  const idsToMark: string[] = [];

  const db = await readDb();
  for (const apt of db.appointments) {
    if (apt.status !== "scheduled" && apt.status !== "waiting") continue;
    if (apt.reminderSentAt) continue;
    if (!isPaymentConfirmed(apt)) continue;

    const doctor = db.doctors.find((d) => d.id === apt.doctorId);
    const patient = db.patients.find((p) => p.id === apt.patientId);
    if (!doctor?.reminderSettings?.enabled || !patient) continue;

    const minutesBefore = doctor.reminderSettings.minutesBefore ?? 1440;
    const scheduledMs = new Date(apt.scheduledAt).getTime();
    const remindAt = scheduledMs - minutesBefore * 60 * 1000;

    if (now < remindAt) continue;
    if (now - remindAt > maxLatenessMs) continue;
    if (now >= scheduledMs) continue;

    const scheduledLabel = format(
      new Date(apt.scheduledAt),
      "EEEE d 'de' MMMM 'a las' HH:mm 'hs'",
      { locale: es },
    );

    try {
      const result = await sendAppointmentReminderEmail({
        patientEmail: override || patient.email,
        patientName: patient.fullName,
        doctorName: doctor.fullName,
        scheduledAt: scheduledLabel,
        waitingRoomUrl: `${baseUrl}/paciente/sala/${apt.accessToken}`,
      });
      if (!result.mock) {
        idsToMark.push(apt.id);
        sent++;
      }
    } catch (err) {
      console.error("[Reminder local] failed for", apt.id, err);
    }
  }

  if (idsToMark.length) {
    const nowIso = new Date().toISOString();
    await writeDb((draft) => {
      for (const id of idsToMark) {
        const apt = draft.appointments.find((a) => a.id === id);
        if (apt) apt.reminderSentAt = nowIso;
      }
    });
  }

  return NextResponse.json({ ok: true, sent, mode: "local" });
}
