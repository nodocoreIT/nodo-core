export type PaymentStatus = "pending" | "confirmed" | "waived";

export interface DoctorPaymentConfig {
  requirePaymentBeforeBooking?: boolean;
  mercadopagoEnabled?: boolean;
  mercadopagoAccessToken?: string;
  consultationFee?: number;
  currency?: string;
  alias?: string;
  cbu?: string;
  bankName?: string;
  paymentInstructions?: string;
  qrImageData?: string;
}

export function doctorRequiresPayment(payment?: DoctorPaymentConfig): boolean {
  return payment?.requirePaymentBeforeBooking !== false;
}

export function doctorUsesMercadoPago(payment?: DoctorPaymentConfig): boolean {
  return !!(
    payment?.mercadopagoEnabled &&
    payment.mercadopagoAccessToken?.trim() &&
    (payment.consultationFee ?? 0) > 0
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
