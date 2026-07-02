import type { PaymentReceiptAudit } from "@/lib/clinic/transfer-receipt-pending";
import type { PaymentReceiptValidationResult } from "@/lib/ai/payment-receipt";

export function buildPaymentReceiptAudit(
  validation: PaymentReceiptValidationResult,
  expectedAmount?: number,
  currency?: string,
): PaymentReceiptAudit {
  const amount = validation.extracted?.amount;
  const payer = validation.extracted?.payerName;
  const recipient = validation.extracted?.recipient;
  const parts = [
    payer ? `De: ${payer}` : null,
    recipient ? `Para: ${recipient}` : null,
    amount != null
      ? `Importe: ${(currency ?? "ARS")} ${amount.toLocaleString("es-AR")}`
      : null,
    validation.extracted?.date
      ? `Fecha comprobante: ${validation.extracted.date}`
      : null,
    validation.extracted?.operationId
      ? `Op: ${validation.extracted.operationId}`
      : null,
  ].filter(Boolean);

  return {
    validatedAt: new Date().toISOString(),
    valid: validation.valid,
    confidence: validation.confidence,
    expectedAmount,
    currency,
    amount,
    recipient,
    payerName: payer,
    transferDate: validation.extracted?.date,
    transferTime: validation.extracted?.time,
    operationId: validation.extracted?.operationId,
    summary: parts.join(" · ") || validation.reasons?.[0],
    checks: validation.checks,
    reasons: validation.reasons,
  };
}
