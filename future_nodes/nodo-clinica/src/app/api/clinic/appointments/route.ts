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
  forbidden,
  requireDoctorSession,
  requirePatientSession,
  unauthorized,
} from "@/lib/clinic/access-control";
import {
  DEFAULT_AVAILABILITY,
  localDateKeyFromDate,
  localDateKeyFromIso,
  appointmentMatchesScheduleGrid,
  slotKeyFromIso,
  addDaysToDateKey,
} from "@/lib/clinic/schedule";
import { doctorRequiresPayment, doctorUsesMercadoPago, isPaymentConfirmed, appointmentNeedsDoctorPaymentReview } from "@/lib/clinic/payment";
import { isStrictPaymentValidation } from "@/lib/clinic/payment-validation";
import { sendAppointmentConfirmationEmail } from "@/lib/email/resend";
import { formatReminderLabel } from "@/lib/email/reminder-label";
import { buildCheckoutForAppointment } from "@/lib/mercadopago/checkout";
import { appBaseUrl, confirmAppointmentPaymentAndNotify } from "@/lib/clinic/appointment-payment";
import type { PaymentStatus } from "@/lib/clinic/local-db";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { appendConsultationArtifacts } from "@/lib/clinic/finalize-appointment";
import { validatePaymentReceipt } from "@/lib/ai/payment-receipt";
import { notifyDoctorTransferPendingReview } from "@/lib/clinic/doctor-notifications";
import {
  receiptDateOlderThanBooking,
  resolveCobroReceiptFields,
} from "@/lib/clinic/cobros-receipt";
import { buildPaymentReceiptAudit } from "@/lib/clinic/payment-receipt-audit";
import { attachDocumentToAppointment } from "@/lib/clinic/appointment-documents";

const APPOINTMENT_STATUS_PRIORITY: Record<string, number> = {
  in_consultation: 0,
  waiting: 1,
  scheduled: 2,
  completed: 3,
};

function dedupeDoctorAppointments<
  T extends { patientId: string; scheduledAt: string; status: string },
>(appointments: T[]): T[] {
  const bySlot = new Map<string, T>();
  for (const apt of appointments) {
    const key = `${apt.patientId}-${slotKeyFromIso(apt.scheduledAt)}`;
    const existing = bySlot.get(key);
    if (!existing) {
      bySlot.set(key, apt);
      continue;
    }
    const aptPriority = APPOINTMENT_STATUS_PRIORITY[apt.status] ?? 9;
    const existingPriority = APPOINTMENT_STATUS_PRIORITY[existing.status] ?? 9;
    if (aptPriority < existingPriority) {
      bySlot.set(key, apt);
    }
  }
  return Array.from(bySlot.values());
}

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
      strictPaymentValidation: isStrictPaymentValidation(),
      documents: db.documents
        .filter((d) => d.appointmentId === apt.id)
        .map((d) => ({
          id: d.id,
          fileName: d.fileName,
          uploadedAt: d.uploadedAt,
          mimeType: d.mimeType,
          downloadUrl: `/api/clinic/documents?id=${d.id}&download=1&token=${encodeURIComponent(apt.accessToken)}`,
        })),
    });
  }

  const session = await getSessionFromRequest(request);

  if (patientId) {
    if (!requirePatientSession(session, patientId)) {
      return unauthorized();
    }
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
    if (!requireDoctorSession(session, doctorId)) {
      return unauthorized();
    }
    const scope = searchParams.get("scope") ?? "upcoming";

    if (scope === "cobros_received") {
      const doctor = db.doctors.find((d) => d.id === doctorId);
      const defaultAmount = doctor?.payment?.consultationFee ?? 0;

      const entries = db.appointments
        .filter(
          (a) =>
            a.doctorId === doctorId &&
            a.paymentStatus === "confirmed" &&
            a.paymentConfirmedAt,
        )
        .sort(
          (a, b) =>
            new Date(b.paymentConfirmedAt!).getTime() -
            new Date(a.paymentConfirmedAt!).getTime(),
        )
        .slice(0, 100)
        .map((apt) => {
          const patient = db.patients.find((p) => p.id === apt.patientId);
          const docs = db.documents.filter((d) => d.appointmentId === apt.id);
          const audit = apt.paymentReceiptAudit;
          const receipt = resolveCobroReceiptFields(apt);
          const receiptTransferDate = receipt.receiptTransferDate;
          return {
            id: apt.id,
            patientName: patient?.fullName ?? "Paciente",
            paidAt: apt.paymentConfirmedAt!,
            bookedAt: apt.createdAt,
            scheduledAt: apt.scheduledAt,
            paymentProvider:
              apt.paymentProvider ??
              (apt.mercadopagoPaymentId ? "mercadopago" : "transfer"),
            amount: audit?.amount ?? defaultAmount,
            currency: "ARS" as const,
            receiptTransferDate,
            receiptTransferTime: receipt.receiptTransferTime,
            operationId: receipt.operationId,
            mercadopagoPaymentId: apt.mercadopagoPaymentId,
            receiptOlderThanBooking: receiptDateOlderThanBooking(
              receiptTransferDate,
              apt.createdAt,
            ),
            documents: docs.map((d) => ({
              id: d.id,
              fileName: d.fileName,
              downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
            })),
          };
        });

      return NextResponse.json({ entries });
    }

    if (scope === "payment_ledger") {
      const entries = db.appointments
        .filter(
          (a) =>
            a.doctorId === doctorId &&
            a.status !== "cancelled" &&
            (a.paymentReceiptAudit ||
              a.paymentStatus === "confirmed" ||
              appointmentNeedsDoctorPaymentReview(a, {
                receiptDocumentCount: db.documents.filter(
                  (d) => d.appointmentId === a.id,
                ).length,
              })),
        )
        .sort((a, b) => {
          const aReview = appointmentNeedsDoctorPaymentReview(a) ? 1 : 0;
          const bReview = appointmentNeedsDoctorPaymentReview(b) ? 1 : 0;
          if (aReview !== bReview) return bReview - aReview;
          return (
            new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
          );
        })
        .slice(0, 50)
        .map((apt) => {
          const patient = db.patients.find((p) => p.id === apt.patientId);
          const docs = db.documents.filter((d) => d.appointmentId === apt.id);
          return {
            id: apt.id,
            scheduledAt: apt.scheduledAt,
            patientName: patient?.fullName ?? "Paciente",
            paymentStatus: apt.paymentStatus,
            paymentProvider: apt.paymentProvider,
            audit: apt.paymentReceiptAudit,
            needsReview: appointmentNeedsDoctorPaymentReview(apt, {
              receiptDocumentCount: docs.length,
            }),
            documents: docs.map((d) => ({
              id: d.id,
              fileName: d.fileName,
              downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
            })),
          };
        });
      return NextResponse.json({ entries });
    }

    if (scope === "pending_payment") {
      const pending = db.appointments
        .filter((a) => {
          const docCount = db.documents.filter(
            (d) => d.appointmentId === a.id,
          ).length;
          return (
            a.doctorId === doctorId &&
            appointmentNeedsDoctorPaymentReview(a, {
              receiptDocumentCount: docCount,
            })
          );
        })
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
        )
        .map((apt) => {
          const patient = db.patients.find((p) => p.id === apt.patientId);
          const docs = db.documents.filter((d) => d.appointmentId === apt.id);
          return {
            id: apt.id,
            scheduledAt: apt.scheduledAt,
            status: apt.status,
            paymentStatus: apt.paymentStatus,
            paymentProvider: apt.paymentProvider,
            paymentReceiptAudit: apt.paymentReceiptAudit,
            intakeReason: apt.intakeReason,
            patient: patient ? publicPatient(patient) : undefined,
            documentCount: docs.length,
            documents: docs.map((d) => ({
              id: d.id,
              fileName: d.fileName,
              uploadedAt: d.uploadedAt,
              downloadUrl: `/api/clinic/documents?id=${d.id}&download=1`,
            })),
          };
        });
      return NextResponse.json(pending);
    }

    const doctor = db.doctors.find((d) => d.id === doctorId);
    const availability = doctor?.availability ?? DEFAULT_AVAILABILITY;
    const todayKey = localDateKeyFromDate(new Date());
    const horizonKey = addDaysToDateKey(todayKey, 60);

    let allowedDates: Set<string> | null = null;
    if (scope === "today") {
      allowedDates = new Set([todayKey]);
    } else if (scope === "active") {
      allowedDates = new Set([todayKey]);
    }

    const filtered = db.appointments
      .filter((a) => {
        if (a.doctorId !== doctorId) return false;
        if (a.status === "cancelled") return false;
        const dateKey = localDateKeyFromIso(a.scheduledAt);
        if (allowedDates) {
          if (!allowedDates.has(dateKey)) return false;
        } else if (scope === "upcoming") {
          if (dateKey < todayKey || dateKey > horizonKey) return false;
        }
        const avail = doctor?.availability ?? DEFAULT_AVAILABILITY;
        if (!appointmentMatchesScheduleGrid(a.scheduledAt, avail)) {
          return false;
        }
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
      });

    const appointments = dedupeDoctorAppointments(filtered)
      .sort((a, b) => {
        const timeDiff =
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        const statusOrder = (s: string) => {
          if (s === "in_consultation") return 0;
          if (s === "waiting") return 1;
          if (s === "scheduled") return 2;
          if (s === "completed") return 3;
          return 4;
        };
        return statusOrder(a.status) - statusOrder(b.status);
      })
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

  const { doctorId, scheduledAt, paymentMethod, shareHealthProfile, receipt, intakeReason, studyFiles } =
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

  const when = scheduledAt ? new Date(scheduledAt) : null;
  if (!when || Number.isNaN(when.getTime())) {
    return NextResponse.json(
      { error: "Horario de turno inválido" },
      { status: 400 },
    );
  }

  const availability = doctor.availability ?? DEFAULT_AVAILABILITY;
  let validatedReceipt:
    | { fileName?: string; mimeType?: string; dataBase64?: string }
    | undefined;
  let receiptAudit: import("@/lib/clinic/local-db").PaymentReceiptAudit | undefined;
  let transferPaymentValidated = false;

  if (requiresPayment && !usesMercadoPago) {
    const receiptPayload = receipt as
      | { fileName?: string; mimeType?: string; dataBase64?: string }
      | undefined;
    if (!receiptPayload?.dataBase64?.trim()) {
      return NextResponse.json(
        {
          error:
            "Subí el comprobante de transferencia para confirmar el turno",
          requiresReceipt: true,
        },
        { status: 402 },
      );
    }

    const fee = doctor.payment?.consultationFee ?? 0;
    const validation = await validatePaymentReceipt({
      imageBase64: receiptPayload.dataBase64,
      mimeType: receiptPayload.mimeType || "image/jpeg",
      fileName: receiptPayload.fileName,
      doctorName: doctor.fullName,
      doctorAlias: doctor.payment?.alias,
      doctorCbu: doctor.payment?.cbu,
      beneficiaryName: doctor.payment?.beneficiaryName,
      expectedAmount: fee,
      currency: doctor.payment?.currency ?? "ARS",
      appointmentDateIso: when.toISOString(),
      slotDurationMinutes: availability.slotDurationMinutes,
    });

    transferPaymentValidated = validation.valid;
    receiptAudit = buildPaymentReceiptAudit(
      validation,
      fee,
      doctor.payment?.currency ?? "ARS",
    );
    validatedReceipt = receiptPayload;
  }

  if (!appointmentMatchesScheduleGrid(when.toISOString(), availability)) {
    return NextResponse.json(
      { error: "El horario elegido está fuera de la agenda del médico" },
      { status: 400 },
    );
  }

  const slotKey = slotKeyFromIso(when.toISOString());
  const slotTaken = db.appointments.some(
    (a) =>
      a.doctorId === doctorId &&
      slotKeyFromIso(a.scheduledAt) === slotKey &&
      a.status !== "cancelled",
  );
  if (slotTaken) {
    return NextResponse.json(
      { error: "Ese horario ya está reservado" },
      { status: 409 },
    );
  }

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
      : transferPaymentValidated
        ? "confirmed"
        : "pending";
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
    shareHealthProfile: !!shareHealthProfile,
    intakeReason: intakeReason ? String(intakeReason).slice(0, 4000) : undefined,
    paymentReceiptAudit: receiptAudit,
    createdAt: now,
    updatedAt: now,
  };

  await writeDb((d) => {
    d.appointments.push(apt);
  });

  if (validatedReceipt?.dataBase64) {
    try {
      const buffer = Buffer.from(
        validatedReceipt.dataBase64.replace(/^data:[^;]+;base64,/, ""),
        "base64",
      );
      await attachDocumentToAppointment(
        apt.id,
        session.userId,
        validatedReceipt.fileName || "comprobante.jpg",
        validatedReceipt.mimeType || "image/jpeg",
        buffer,
      );
    } catch (err) {
      console.error("[appointments] receipt attach failed", err);
    }
  }

  const studies = Array.isArray(studyFiles) ? studyFiles : [];
  for (const study of studies) {
    if (!study?.dataBase64) continue;
    try {
      const buffer = Buffer.from(
        String(study.dataBase64).replace(/^data:[^;]+;base64,/, ""),
        "base64",
      );
      await attachDocumentToAppointment(
        apt.id,
        session.userId,
        study.fileName || "estudio.pdf",
        study.mimeType || "application/pdf",
        buffer,
      );
    } catch (err) {
      console.error("[appointments] study attach failed", err);
    }
  }

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

  const paymentPendingReview =
    requiresPayment && !usesMercadoPago && !transferPaymentValidated;
  if (paymentPendingReview) {
    await notifyDoctorTransferPendingReview({
      doctorId: doctor.id,
      appointmentId: apt.id,
      patientName: patient.fullName,
    });
  }

  return NextResponse.json({
    appointment: apt,
    waitingRoomUrl,
    requiresPayment,
    paymentProvider: "transfer",
    paymentPendingReview,
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const {
    appointmentId,
    status,
    accessToken,
    doctorId,
    action,
    intakeReason,
    transcription,
    clinicalNotes,
  } = body;

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

  if (action === "patientCancelAppointment" && accessToken) {
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
    if (apt.status !== "scheduled") {
      return NextResponse.json(
        { error: "Este turno ya no se puede cancelar desde acá" },
        { status: 400 },
      );
    }
    if (apt.paymentStatus !== "pending") {
      return NextResponse.json(
        { error: "Solo podés cancelar turnos con pago pendiente" },
        { status: 400 },
      );
    }
    const now = new Date().toISOString();
    await writeDb((d) => {
      const target = d.appointments.find((a) => a.id === apt!.id);
      if (!target) return;
      target.status = "cancelled";
      target.paymentStatus = "rejected";
      target.updatedAt = now;
    });
    const updated = (await readDb()).appointments.find((a) => a.id === apt!.id);
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
    if (session?.role === "patient" && isStrictPaymentValidation()) {
      return NextResponse.json(
        {
          error:
            "En producción debés validar el comprobante con IA o pedir al médico que confirme el pago.",
        },
        { status: 403 },
      );
    }
    const updated = await confirmAppointmentPaymentAndNotify(apt.id);
    return NextResponse.json(updated ?? apt);
  }

  if (action === "doctorConfirmPayment" && appointmentId) {
    const session = await getSessionFromRequest(request);
    if (session?.role !== "doctor") {
      return NextResponse.json({ error: "Solo el médico puede confirmar" }, { status: 403 });
    }
    const db = await readDb();
    const apt = db.appointments.find((a) => a.id === appointmentId);
    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    if (apt.doctorId !== session.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const updated = await confirmAppointmentPaymentAndNotify(appointmentId);
    return NextResponse.json(updated ?? apt);
  }

  if (action === "doctorRejectPayment" && appointmentId) {
    const session = await getSessionFromRequest(request);
    if (session?.role !== "doctor") {
      return NextResponse.json({ error: "Solo el médico puede rechazar" }, { status: 403 });
    }
    const db = await readDb();
    const apt = db.appointments.find((a) => a.id === appointmentId);
    if (!apt) {
      return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
    }
    if (apt.doctorId !== session.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const now = new Date().toISOString();
    await writeDb((d) => {
      const target = d.appointments.find((a) => a.id === apt!.id);
      if (!target) return;
      target.paymentStatus = "rejected";
      target.status = "cancelled";
      target.updatedAt = now;
    });
    const updated = (await readDb()).appointments.find((a) => a.id === apt!.id);
    return NextResponse.json(updated);
  }

  if (action === "clearStuck" && doctorId) {
    const session = await getSessionFromRequest(request);
    if (!requireDoctorSession(session, doctorId)) {
      return forbidden();
    }
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

  const session = await getSessionFromRequest(request);
  const db = await readDb();
  let apt = appointmentId
    ? db.appointments.find((a) => a.id === appointmentId)
    : db.appointments.find((a) => a.accessToken === accessToken);

  if (!apt) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  if (!requireDoctorSession(session) || apt.doctorId !== session.userId) {
    return forbidden("Solo el médico del turno puede actualizar la consulta");
  }

  await writeDb(async (d) => {
    const target = d.appointments.find((a) => a.id === apt!.id);
    if (!target) return;
    if (status) {
      const now = new Date().toISOString();
      if (status === "in_consultation") {
        for (const other of d.appointments) {
          if (
            other.doctorId === target.doctorId &&
            other.id !== target.id &&
            other.status === "in_consultation"
          ) {
            other.status = "completed";
            other.updatedAt = now;
          }
        }
      }
      target.status = status;
      target.updatedAt = now;

      if (status === "completed") {
        if (clinicalNotes?.trim() && d.clinicalNotes[target.id]) {
          d.clinicalNotes[target.id] = {
            ...d.clinicalNotes[target.id],
            content: clinicalNotes.trim(),
            updatedAt: new Date().toISOString(),
          };
        } else if (clinicalNotes?.trim()) {
          d.clinicalNotes[target.id] = {
            appointmentId: target.id,
            doctorId: target.doctorId,
            content: clinicalNotes.trim(),
            updatedAt: new Date().toISOString(),
          };
        }
        await appendConsultationArtifacts(d, target.id, {
          transcription,
          clinicalNotes,
        });
      }
    }
  });

  const updated = (await readDb()).appointments.find((a) => a.id === apt!.id);
  return NextResponse.json(updated);
}
