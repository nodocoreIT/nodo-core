import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/clinic/local-db";
import { isPaymentConfirmed } from "@/lib/clinic/payment";
import { sendAppointmentReminderEmail } from "@/lib/email/resend";
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

  const db = await readDb();
  const now = Date.now();
  /** Hobby: cron corre 1×/día; enviamos si ya pasó la hora del aviso (hasta 36 h de tolerancia). */
  const maxLatenessMs = 36 * 60 * 60 * 1000;
  let sent = 0;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  for (const apt of db.appointments) {
    if (!["scheduled", "waiting"].includes(apt.status)) continue;
    if (!isPaymentConfirmed(apt)) continue;
    if (apt.reminderSentAt) continue;

    const doctor = db.doctors.find((d) => d.id === apt.doctorId);
    const patient = db.patients.find((p) => p.id === apt.patientId);
    if (!doctor || !patient) continue;

    const settings = doctor.reminderSettings;
    if (!settings?.enabled) continue;

    const minutesBefore = settings.minutesBefore ?? 1440;
    const scheduledMs = new Date(apt.scheduledAt).getTime();
    const remindAt = scheduledMs - minutesBefore * 60 * 1000;

    if (now < remindAt) continue;
    if (now - remindAt > maxLatenessMs) continue;
    if (now >= scheduledMs) continue;

    const scheduledLabel = format(
      new Date(apt.scheduledAt),
      "EEEE d 'de' MMMM 'a las' HH:mm 'hs'",
      { locale: es }
    );

    try {
      await sendAppointmentReminderEmail({
        patientEmail: patient.email,
        patientName: patient.fullName,
        doctorName: doctor.fullName,
        scheduledAt: scheduledLabel,
        waitingRoomUrl: `${baseUrl}/paciente/sala/${apt.accessToken}`,
      });

      await writeDb((d) => {
        const target = d.appointments.find((a) => a.id === apt.id);
        if (target) {
          target.reminderSentAt = new Date().toISOString();
          target.updatedAt = new Date().toISOString();
        }
      });
      sent++;
    } catch (err) {
      console.error("[Reminder] failed for", apt.id, err);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
