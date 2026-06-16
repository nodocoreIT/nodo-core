import type { LocalAppointment, LocalDoctor, PaymentStatus } from "@/lib/clinic/local-db";

/** Exige pago simulado salvo que el médico lo desactive explícitamente en Cobros. */
export function doctorRequiresPayment(doctor: LocalDoctor): boolean {
  return doctor.payment?.requirePaymentBeforeBooking !== false;
}

export function doctorUsesMercadoPago(doctor: LocalDoctor): boolean {
  const p = doctor.payment;
  return !!(
    p?.mercadopagoEnabled &&
    p.mercadopagoAccessToken?.trim() &&
    (p.consultationFee ?? 0) > 0
  );
}

export function patientUsesMercadoPago(payment?: {
  mercadopagoEnabled?: boolean;
  consultationFee?: number;
}): boolean {
  return !!(payment?.mercadopagoEnabled && (payment.consultationFee ?? 0) > 0);
}

export function patientRequiresPayment(payment?: {
  requirePaymentBeforeBooking?: boolean;
}): boolean {
  return payment?.requirePaymentBeforeBooking !== false;
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
