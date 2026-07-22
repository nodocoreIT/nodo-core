import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { appBaseUrl, patientLoginUrl } from "@/lib/clinic/appointment-payment";
import { attachDocumentToAppointment } from "@/lib/clinic/appointment-documents";
import { buildPaymentReceiptAudit } from "@/lib/clinic/payment-receipt-audit";
import { notifyDoctorTransferPendingReview } from "@/lib/clinic/doctor-notifications";
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
import {
  doctorRequiresPayment,
  doctorUsesMercadoPago,
  isPaymentConfirmed,
} from "@/lib/clinic/payment";
import { validatePaymentReceipt } from "@/lib/ai/payment-receipt";
import { sendAppointmentConfirmationEmail } from "@/lib/email/resend";
import { formatReminderLabel } from "@/lib/email/reminder-label";
import { buildCheckoutForAppointment } from "@/lib/mercadopago/checkout";

/** POST /api/clinic/appointments en CLINIC_MODE=local (reservar turno). */
export async function handleAppointmentsPostLocal(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "patient") {
    return NextResponse.json(
      { error: "Debe iniciar sesión como paciente" },
      { status: 401 },
    );
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
          "Tu sesión no coincide con la base de datos. Cerrá sesión e ingresá de nuevo.",
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
          error: "Subí el comprobante de transferencia para confirmar el turno",
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
      isPaymentConfirmed(a),
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
    tokenExpiresAt: new Date(when.getTime() + 24 * 60 * 60 * 1000).toISOString(),
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
          { status: 500 },
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
        { status: 502 },
      );
    }
  }

  const scheduledLabel = format(when, "EEEE d 'de' MMMM 'a las' HH:mm 'hs'", {
    locale: es,
  });

  let reminderNote: string | undefined;
  if (doctor.reminderSettings?.enabled) {
    reminderNote = `Te enviaremos un recordatorio ${formatReminderLabel(
      doctor.reminderSettings.minutesBefore ?? 1440,
    )} del turno a ${patient.email}.`;
  }

  sendAppointmentConfirmationEmail({
    patientEmail: patient.email,
    patientName: patient.fullName,
    doctorName: doctor.fullName,
    scheduledAt: scheduledLabel,
    waitingRoomUrl: patientLoginUrl(baseUrl),
    reminderNote,
  }).catch((err) => console.error("[Email] confirmation failed", err));

  const paymentPendingReview =
    requiresPayment && !usesMercadoPago && !transferPaymentValidated;
  if (paymentPendingReview) {
    await notifyDoctorTransferPendingReview({
      doctorId: doctor.id,
      orgId: doctor.id,
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
