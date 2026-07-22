import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  readDb,
  writeDb,
  newId,
  newToken,
  type PaymentStatus,
} from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import {
  DEFAULT_AVAILABILITY,
  appointmentMatchesScheduleGrid,
  slotKeyFromIso,
  localDateKeyFromIso,
} from "@/lib/clinic/schedule";
import { doctorRequiresPayment, isPaymentConfirmed } from "@/lib/clinic/payment";
import {
  appBaseUrl,
  patientTurnosPaymentUrl,
} from "@/lib/clinic/appointment-payment";
import {
  sendAppointmentConfirmationEmail,
  sendDoctorAssignedAppointmentEmail,
} from "@/lib/email/resend";
import { formatReminderLabel } from "@/lib/email/reminder-label";

const DOCTOR_ROLES = new Set(["doctor", "admin", "super_admin"]);

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** POST /api/clinic/appointments/assign en CLINIC_MODE=local. */
export async function handleAppointmentsAssignLocal(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || !DOCTOR_ROLES.includes(session.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const {
    patientId,
    patientEmail: patientEmailOverride,
    scheduledAt,
    scheduledAtList,
    intakeReason,
  } = body as {
    patientId?: string;
    patientEmail?: string;
    scheduledAt?: string;
    scheduledAtList?: string[];
    intakeReason?: string;
  };

  if (!patientId) {
    return NextResponse.json({ error: "Paciente requerido" }, { status: 400 });
  }

  const slots = [
    ...(Array.isArray(scheduledAtList) ? scheduledAtList : []),
    ...(scheduledAt ? [scheduledAt] : []),
  ]
    .map((iso) => iso?.trim())
    .filter(Boolean)
    .map((iso) => new Date(iso!).toISOString());

  const uniqueSlots = [...new Set(slots)];
  if (uniqueSlots.length === 0) {
    return NextResponse.json({ error: "Elegí al menos un horario" }, { status: 400 });
  }

  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === session.userId);
  if (!doctor || doctor.subscriptionStatus === "expired") {
    return NextResponse.json({ error: "Médico no disponible" }, { status: 404 });
  }

  const patient = db.patients.find((p) => p.id === patientId);
  if (!patient) {
    return NextResponse.json({ error: "Paciente no encontrado" }, { status: 404 });
  }

  const notifyEmail = patientEmailOverride?.trim()
    ? normalizeEmail(patientEmailOverride)
    : normalizeEmail(patient.email ?? "");

  if (!notifyEmail || !isValidEmail(notifyEmail)) {
    return NextResponse.json({ error: "Ingresá un email válido para el paciente" }, { status: 400 });
  }

  const requiresPayment = doctorRequiresPayment(doctor);
  const availability = doctor.availability ?? DEFAULT_AVAILABILITY;
  const paymentStatus: PaymentStatus = requiresPayment ? "pending" : "waived";
  const baseUrl = appBaseUrl();

  const created: Array<{
    id: string;
    scheduledAt: string;
    accessToken: string;
    paymentStatus: PaymentStatus;
    requiresPayment: boolean;
  }> = [];

  const newAppointments: typeof db.appointments = [];

  const takenSlotKeys = new Set(
    db.appointments
      .filter((a) => a.doctorId === doctor.id && a.status !== "cancelled")
      .map((a) => slotKeyFromIso(a.scheduledAt)),
  );

  const oneHourMs = 60 * 60 * 1000;

  for (const scheduledAtIso of uniqueSlots) {
    const when = new Date(scheduledAtIso);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: "Horario de turno inválido" }, { status: 400 });
    }

    const slotKey = slotKeyFromIso(when.toISOString());
    if (takenSlotKeys.has(slotKey)) {
      return NextResponse.json(
        { error: "Uno de los horarios elegidos ya está reservado" },
        { status: 409 },
      );
    }

    const windowStart = new Date(when.getTime() - oneHourMs).toISOString();
    const windowEnd = new Date(when.getTime() + oneHourMs).toISOString();
    const patientConflict = db.appointments.some(
      (a) =>
        a.patientId === patient.id &&
        ["scheduled", "waiting", "in_consultation"].includes(a.status) &&
        a.scheduledAt > windowStart &&
        a.scheduledAt < windowEnd,
    );
    if (patientConflict) {
      return NextResponse.json(
        {
          error:
            "El paciente ya tiene un turno activo a menos de 1 hora de uno de los horarios elegidos",
        },
        { status: 409 },
      );
    }

    if (!appointmentMatchesScheduleGrid(when.toISOString(), availability)) {
      return NextResponse.json(
        { error: "Uno de los horarios está fuera de la agenda del médico" },
        { status: 400 },
      );
    }

    const whenDateKey = localDateKeyFromIso(when.toISOString());
    const queueToday = db.appointments.filter(
      (a) =>
        a.doctorId === doctor.id &&
        localDateKeyFromIso(a.scheduledAt) === whenDateKey &&
        isPaymentConfirmed(a),
    ).length;

    const now = new Date().toISOString();
    const apt = {
      id: newId("apt"),
      doctorId: doctor.id,
      patientId: patient.id,
      scheduledAt: when.toISOString(),
      status: "scheduled" as const,
      queuePosition: queueToday + 1,
      jitsiRoomId: `clinica-${doctor.id.slice(-8)}-${Date.now()}`,
      accessToken: newToken(),
      tokenExpiresAt: new Date(when.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      paymentStatus,
      paymentProvider: "transfer" as const,
      paymentConfirmedAt: paymentStatus === "waived" ? now : undefined,
      shareHealthProfile: false,
      intakeReason: intakeReason ? String(intakeReason).slice(0, 4000) : undefined,
      createdAt: now,
      updatedAt: now,
    };

    newAppointments.push(apt);
    takenSlotKeys.add(slotKey);

    const scheduledLabel = format(when, "EEEE d 'de' MMMM 'a las' HH:mm 'hs'", {
      locale: es,
    });
    const loginUrl = patientTurnosPaymentUrl(apt.accessToken, baseUrl);

    if (requiresPayment) {
      sendDoctorAssignedAppointmentEmail({
        patientEmail: notifyEmail,
        patientName: patient.fullName,
        doctorName: doctor.fullName,
        scheduledAt: scheduledLabel,
        loginUrl,
        consultationFee: doctor.payment?.consultationFee,
        currency: doctor.payment?.currency ?? "ARS",
      }).catch((err) =>
        console.error("[Email] doctor-assigned appointment failed", err),
      );
    } else {
      let reminderNote: string | undefined;
      if (doctor.reminderSettings?.enabled) {
        reminderNote = `Te enviaremos un recordatorio ${formatReminderLabel(
          doctor.reminderSettings.minutesBefore ?? 1440,
        )} del turno a ${notifyEmail}.`;
      }

      sendAppointmentConfirmationEmail({
        patientEmail: notifyEmail,
        patientName: patient.fullName,
        doctorName: doctor.fullName,
        scheduledAt: scheduledLabel,
        waitingRoomUrl: loginUrl,
        reminderNote,
      }).catch((err) =>
        console.error("[Email] doctor-assigned confirmation failed", err),
      );
    }

    created.push({
      id: apt.id,
      scheduledAt: when.toISOString(),
      accessToken: apt.accessToken,
      paymentStatus,
      requiresPayment,
    });
  }

  await writeDb((d) => {
    d.appointments.push(...newAppointments);
    if (notifyEmail !== normalizeEmail(patient.email ?? "")) {
      const row = d.patients.find((p) => p.id === patient.id);
      if (row) row.email = notifyEmail;
    }
  });

  return NextResponse.json({
    ok: true,
    appointments: created,
    patientEmail: notifyEmail,
    patientName: patient.fullName,
    count: created.length,
  });
}
