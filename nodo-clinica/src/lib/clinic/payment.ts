import type {
  LocalAppointment,
  LocalDoctor,
  PaymentReceiptAudit,
  PaymentStatus,
} from "@/lib/clinic/types";
import { doctorHasMercadoPagoConnection } from "@/lib/mercadopago/connection";

/** Exige pago simulado salvo que el médico lo desactive explícitamente en Cobros. */
export function doctorRequiresPayment(doctor: LocalDoctor): boolean {
  return doctor.payment?.requirePaymentBeforeBooking !== false;
}

/** Token del médico o fallback de entorno (Vercel). Solo lectura; usar getDoctorMercadoPagoAccessToken para refresh. */
export function resolveMercadoPagoAccessToken(
  doctor?: LocalDoctor,
): string | undefined {
  const doctorToken = doctor?.payment?.mercadopagoAccessToken?.trim();
  if (doctorToken && !doctorToken.startsWith("····")) {
    return doctorToken;
  }
  return (
    process.env.CLINIC_MERCADOPAGO_ACCESS_TOKEN?.trim() ||
    process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ||
    undefined
  );
}

export function doctorUsesMercadoPago(doctor: LocalDoctor): boolean {
  const p = doctor.payment;
  return !!(
    p?.mercadopagoEnabled &&
    doctorHasMercadoPagoConnection(doctor) &&
    (p.consultationFee ?? 0) > 0
  );
}

export function patientCanPayWithMercadoPago(payment?: {
  mercadopagoEnabled?: boolean;
  consultationFee?: number;
  mercadopagoReady?: boolean;
}): boolean {
  return !!(
    payment?.mercadopagoEnabled &&
    payment.mercadopagoReady &&
    (payment.consultationFee ?? 0) > 0
  );
}

/** @deprecated Use patientCanPayWithMercadoPago */
export function patientUsesMercadoPago(payment?: {
  mercadopagoEnabled?: boolean;
  consultationFee?: number;
  mercadopagoReady?: boolean;
}): boolean {
  return patientCanPayWithMercadoPago(payment);
}

/** Turno con comprobante que requiere OK manual del médico. */
export function appointmentNeedsDoctorPaymentReview(
  apt: {
    status: string;
    paymentStatus?: PaymentStatus;
    paymentProvider?: string;
    paymentReceiptAudit?: PaymentReceiptAudit;
  },
  opts?: { receiptDocumentCount?: number },
): boolean {
  if (apt.status === "cancelled") return false;
  if (apt.paymentProvider === "mercadopago") return false;
  if (apt.paymentStatus === "confirmed" || apt.paymentStatus === "waived") {
    return false;
  }

  const hasReceipt =
    !!apt.paymentReceiptAudit || (opts?.receiptDocumentCount ?? 0) > 0;
  if (!hasReceipt) return false;

  if (apt.paymentReceiptAudit?.valid) return false;

  return apt.paymentStatus === "pending" || !apt.paymentReceiptAudit?.valid;
}

export function patientRequiresPayment(payment?: {
  requirePaymentBeforeBooking?: boolean;
}): boolean {
  return payment?.requirePaymentBeforeBooking !== false;
}

/** Paso "Pago" en el wizard: honorarios configurados o pago exigido por el médico. */
export function patientShowsPaymentStep(payment?: {
  requirePaymentBeforeBooking?: boolean;
  consultationFee?: number;
  alias?: string;
  cbu?: string;
  mercadopagoEnabled?: boolean;
}): boolean {
  if (!payment) return true;
  if (payment.requirePaymentBeforeBooking === false) {
    return (
      (payment.consultationFee ?? 0) > 0 ||
      !!payment.alias?.trim() ||
      !!payment.cbu?.trim() ||
      !!payment.mercadopagoEnabled
    );
  }
  return true;
}

export function isPaymentConfirmed(apt: {
  paymentStatus?: PaymentStatus;
}): boolean {
  return (
    !apt.paymentStatus ||
    apt.paymentStatus === "confirmed" ||
    apt.paymentStatus === "waived"
  );
}

export function appointmentBlocksSlot(apt: LocalAppointment): boolean {
  if (apt.status === "cancelled" || apt.status === "completed") return false;
  return isPaymentConfirmed(apt);
}
