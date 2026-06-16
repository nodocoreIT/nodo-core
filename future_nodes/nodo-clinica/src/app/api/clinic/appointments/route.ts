import { NextRequest, NextResponse } from "next/server";
import {
  readDb,
  writeDb,
  newId,
  newToken,
  publicDoctor,
  publicDoctorSummary,
  publicPatient,
} from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import {
  DEFAULT_AVAILABILITY,
  getUpcomingWorkingDateKeys,
  localDateKeyFromDate,
  localDateKeyFromIso,
} from "@/lib/clinic/schedule";
import { doctorRequiresPayment, doctorUsesMercadoPago, isPaymentConfirmed } from "@/lib/clinic/payment";
import { sendAppointmentConfirmationEmail } from "@/lib/email/resend";
import { formatReminderLabel } from "@/lib/email/reminder-label";
import { buildCheckoutForAppointment } from "@/lib/mercadopago/checkout";
import { appBaseUrl } from "@/lib/clinic/appointment-payment";
import type { PaymentStatus } from "@/lib/clinic/local-db";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId");
  const patientId = searchParams.get("patientId");
  const token = searchParams.get("token");
  const db = await readDb();

  if (token) {
    const apt = db.appointments.find((a) => a.accessToken === token);
    if (!apt) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });

    const patient = db.patients.find((p) => p.id === apt.patientId);
    const doctor = db.doctors.find((d) => d.id === apt.doctorId);
    const waiting = db.appointments.filter(
      (a) =>
        a.doctorId === apt.doctorId &&
        ["waiting", "in_consultation"].includes(a.status)
    ).length;
    const ahead = db.appointments.filter(
      (a) =>
        a.doctorId === apt.doctorId &&
        ["waiting", "in_consultation"].includes(a.status) &&
        a.queuePosition < apt.queuePosition
    ).length;

    return NextResponse.json({
      appointment: apt,
      patient: patient ? publicPatient(patient) : undefined,
      doctor: doctor ? publicDoctorSummary(doctor) : undefined,
      queuePosition: ahead + 1,
      totalWaiting: waiting,
      documents: db.documents
        .filter((d) => d.appointmentId === apt.id)
        .map((d) => ({
          id: d.id,
          fileName: d.fileName,
          uploadedAt: d.uploadedAt,
          mimeType: d.mimeType,
          downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
        })),
    });
  }

  if (patientId) {
    const appointments = db.appointments
      .filter((a) => a.patientId === patientId)
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
      .map((apt) => ({
        ...apt,
        doctor: db.doctors.find((d) => d.id === apt.doctorId),
      }));
    return NextResponse.json(appointments);
  }

  if (doctorId) {
    const scope = searchParams.get("scope") ?? "upcoming";
    const doctor = db.doctors.find((d) => d.id === doctorId);
    const availability = doctor?.availability ?? DEFAULT_AVAILABILITY;

    let allowedDates: Set<string>;
    if (scope === "today") {
      allowedDates = new Set([localDateKeyFromDate(new Date())]);
    } else if (scope === "active") {
      allowedDates = new Set([localDateKeyFromDate(new Date())]);
    } else {
      // upcoming: today + próximos días laborables configurados
      allowedDates = new Set(getUpcomingWorkingDateKeys(availability, 3));
    }

    const appointments = db.appointments
      .filter((a) => {
        if (a.doctorId !== doctorId) return false;
        if (a.status === "cancelled") return false;
        const dateKey = localDateKeyFromIso(a.scheduledAt);
        if (!allowedDates.has(dateKey)) return false;
        if (scope === "active") {
          return (
            ["scheduled", "waiting", "in_consultation"].includes(a.status) &&
            isPaymentConfirmed(a)
          );
        }
        if (scope === "upcoming") {
          return isPaymentConfirmed(a);
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      )
      .map((apt) => {
        const patient = db.patients.find((p) => p.id === apt.patientId);
        const aptDocs = db.documents.filter((d) => d.appointmentId === apt.id);
        const recordCount = db.clinicalRecords.filter(
          (r) => r.patientId === apt.patientId
        ).length;
        return {
          ...apt,
          patient: patient
            ? {
                id: patient.id,
                fullName: patient.fullName,
                email: patient.email,
                phone: patient.phone,
                profilePhotoData: patient.profilePhotoData,
              }
            : undefined,
          documentCount: aptDocs.length,
          clinicalRecordCount: recordCount,
          hasNewDocuments: aptDocs.length > 0,
        };
      });
    return NextResponse.json(appointments);
  }

  return NextResponse.json({ error: "Parámetro requerido" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "patient") {
    return NextResponse.json({ error: "Debe iniciar sesión como paciente" }, { status: 401 });
  }

  const { doctorId, scheduledAt, confirmPayment, paymentMethod } =
    await request.json();
  if (!doctorId) {
    return NextResponse.json({ error: "Médico requerido" }, { status: 400 });
  }

  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === doctorId);
  if (!doctor || doctor.subscriptionStatus === "expired") {
    return NextResponse.json({ error: "Médico no disponible" }, { status: 404 });
  }

  const patient = db.patients.find((p) => p.id === session.userId);
  if (!patient) {
    return NextResponse.json(
      {
        error:
          "Tu sesión no coincide con la base de datos. Cerrá sesión e ingresá de nuevo con paciente1@nodo.demo",
      },
      { status: 404 },
    );
  }

  const requiresPayment = doctorRequiresPayment(doctor);
  const usesMercadoPago =
    paymentMethod === "mercadopago" && doctorUsesMercadoPago(doctor);

  if (requiresPayment && !usesMercadoPago && !confirmPayment) {
    return NextResponse.json(
      {
        error: "Debe confirmar la transferencia antes de reservar el turno",
        requiresPayment: true,
        payment: publicDoctor(doctor).payment,
      },
      { status: 402 }
    );
  }

  const when = scheduledAt ? new Date(scheduledAt) : new Date();
  const whenDateKey = localDateKeyFromIso(when.toISOString());
  const queueToday = db.appointments.filter(
    (a) =>
      a.doctorId === doctorId &&
      localDateKeyFromIso(a.scheduledAt) === whenDateKey &&
      isPaymentConfirmed(a)
  ).length;

  const paymentStatus: PaymentStatus = !requiresPayment
    ? "waived"
    : usesMercadoPago
      ? "pending"
      : "confirmed";
  const now = new Date().toISOString();

  const apt = {
    id: newId("apt"),
    doctorId,
    patientId: session.userId,
    scheduledAt: when.toISOString(),
    status: "scheduled" as const,
    queuePosition: queueToday + 1,
    jitsiRoomId: `clinica-${doctorId.slice(-8)}-${Date.now()}`,
    accessToken: newToken(),
    tokenExpiresAt: new Date(
      when.getTime() + 24 * 60 * 60 * 1000
    ).toISOString(),
    paymentStatus,
    paymentProvider: usesMercadoPago ? ("mercadopago" as const) : ("transfer" as const),
    paymentConfirmedAt: paymentStatus === "confirmed" ? now : undefined,
    createdAt: now,
    updatedAt: now,
  };

  await writeDb((d) => {
    d.appointments.push(apt);
  });

  const baseUrl = appBaseUrl();
  const waitingRoomUrl = `/paciente/sala/${apt.accessToken}`;

  if (usesMercadoPago) {
    try {
      const checkout = await buildCheckoutForAppointment(apt.id);
      if (!checkout) {
        return NextResponse.json(
          { error: "No se pudo iniciar el pago con Mercado Pago" },
          { status: 500 }
        );
      }
      return NextResponse.json({
        appointment: apt,
        waitingRoomUrl,
        checkoutUrl: checkout.checkoutUrl,
        paymentProvider: "mercadopago",
        requiresPayment: true,
      });
    } catch (err) {
      await writeDb((d) => {
        d.appointments = d.appointments.filter((a) => a.id !== apt.id);
      });
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Error al crear checkout de Mercado Pago",
        },
        { status: 502 }
      );
    }
  }

  const scheduledLabel = format(when, "EEEE d 'de' MMMM 'a las' HH:mm 'hs'", {
    locale: es,
  });

  let reminderNote: string | undefined;
  if (doctor.reminderSettings?.enabled) {
    reminderNote = `Te enviaremos un recordatorio ${formatReminderLabel(
      doctor.reminderSettings.minutesBefore ?? 1440
    )} del turno a ${patient.email}.`;
  }

  sendAppointmentConfirmationEmail({
    patientEmail: patient.email,
    patientName: patient.fullName,
    doctorName: doctor.fullName,
    scheduledAt: scheduledLabel,
    waitingRoomUrl: `${baseUrl}/paciente/sala/${apt.accessToken}`,
    reminderNote,
  }).catch((err) => console.error("[Email] confirmation failed", err));

  return NextResponse.json({
    appointment: apt,
    waitingRoomUrl,
    requiresPayment,
    paymentProvider: "transfer",
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { appointmentId, status, accessToken, doctorId, action, intakeReason } =
    body;

  if (action === "saveIntake" && accessToken) {
    const db = await readDb();
    const apt = db.appointments.find((a) => a.accessToken === accessToken);
    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    await writeDb((d) => {
      const target = d.appointments.find((a) => a.id === apt.id);
      if (!target) return;
      target.intakeReason = String(intakeReason ?? "").slice(0, 4000);
      target.updatedAt = new Date().toISOString();
    });
    const updated = (await readDb()).appointments.find((a) => a.id === apt.id);
    return NextResponse.json(updated);
  }

  if (action === "confirmPayment" && accessToken) {
    const session = await getSessionFromRequest(request);
    const db = await readDb();
    const apt = db.appointments.find((a) => a.accessToken === accessToken);
    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    if (
      session?.role === "patient" &&
      session.userId !== apt.patientId
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    if (apt.paymentStatus === "confirmed" || apt.paymentStatus === "waived") {
      return NextResponse.json(apt);
    }
    const now = new Date().toISOString();
    await writeDb((d) => {
      const target = d.appointments.find((a) => a.id === apt!.id);
      if (!target) return;
      target.paymentStatus = "confirmed";
      target.paymentConfirmedAt = now;
      target.updatedAt = now;
    });
    const updated = (await readDb()).appointments.find((a) => a.id === apt!.id);
    return NextResponse.json(updated);
  }

  if (action === "clearStuck" && doctorId) {
    let cleared = 0;
    await writeDb((d) => {
      for (const apt of d.appointments) {
        if (apt.doctorId === doctorId && apt.status === "in_consultation") {
          apt.status = "completed";
          apt.updatedAt = new Date().toISOString();
          cleared++;
        }
      }
    });
    return NextResponse.json({ ok: true, cleared });
  }

  const db = await readDb();
  let apt = appointmentId
    ? db.appointments.find((a) => a.id === appointmentId)
    : db.appointments.find((a) => a.accessToken === accessToken);

  if (!apt) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  await writeDb((d) => {
    const target = d.appointments.find((a) => a.id === apt!.id);
    if (!target) return;
    if (status) {
      target.status = status;
      target.updatedAt = new Date().toISOString();

      if (status === "completed") {
        const note = d.clinicalNotes[target.id];
        const already = d.clinicalRecords.some(
          (r) =>
            r.patientId === target.patientId &&
            r.title.includes(target.scheduledAt.slice(0, 10))
        );
        if (note?.content && !already) {
          const doctor = d.doctors.find((doc) => doc.id === target.doctorId);
          d.clinicalRecords.push({
            id: newId("rec"),
            patientId: target.patientId,
            doctorId: target.doctorId,
            title: `Consulta — ${new Date(target.scheduledAt).toLocaleDateString("es-AR")}${doctor ? ` · ${doctor.fullName}` : ""}`,
            content: note.content,
            recordType: "consultation",
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  });

  const updated = (await readDb()).appointments.find((a) => a.id === apt!.id);
  return NextResponse.json(updated);
}
