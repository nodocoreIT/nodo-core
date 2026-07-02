import { parseReceiptDate } from "@/lib/clinic/payment-validation";
import {
  localDateKeyFromDate,
  localDateKeyFromIso,
} from "@/lib/clinic/schedule";

/** Fecha del comprobante anterior al día en que el paciente reservó el turno. */
export function receiptDateOlderThanBooking(
  transferDate: string | undefined,
  bookedAtIso: string,
): boolean {
  const parsed = parseReceiptDate(transferDate);
  if (!parsed) return false;
  const receiptKey = localDateKeyFromDate(parsed);
  const bookingKey = localDateKeyFromIso(bookedAtIso);
  return receiptKey < bookingKey;
}

export function formatReceiptDateDisplay(
  transferDate?: string,
  transferTime?: string,
): string | null {
  if (!transferDate?.trim()) return null;
  const trimmed = transferDate.trim();
  if (transferTime?.trim()) {
    return `${trimmed} ${transferTime.trim()}`;
  }
  return trimmed;
}

function parseAuditSummaryField(
  summary: string | undefined,
  prefix: string,
): string | undefined {
  if (!summary) return undefined;
  const re = new RegExp(`${prefix}:\\s*([^·]+)`);
  const match = summary.match(re);
  return match?.[1]?.trim();
}

/** Fecha y referencia para la grilla de cobros (transferencia o Mercado Pago). */
export function resolveCobroReceiptFields(apt: {
  paymentConfirmedAt?: string;
  mercadopagoPaymentId?: string;
  paymentProvider?: "transfer" | "mercadopago";
  paymentReceiptAudit?: {
    transferDate?: string;
    transferTime?: string;
    operationId?: string;
    summary?: string;
  };
}): {
  receiptTransferDate?: string;
  receiptTransferTime?: string;
  operationId?: string;
} {
  const audit = apt.paymentReceiptAudit;
  const isMp =
    apt.paymentProvider === "mercadopago" || !!apt.mercadopagoPaymentId;

  let receiptTransferDate =
    audit?.transferDate ||
    parseAuditSummaryField(audit?.summary, "Fecha comprobante");
  let receiptTransferTime = audit?.transferTime;
  let operationId =
    audit?.operationId || parseAuditSummaryField(audit?.summary, "Op");

  if (!receiptTransferDate && isMp && apt.paymentConfirmedAt) {
    const paid = new Date(apt.paymentConfirmedAt);
    receiptTransferDate = paid.toLocaleDateString("es-AR");
    receiptTransferTime = paid.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (!operationId && apt.mercadopagoPaymentId) {
    operationId = apt.mercadopagoPaymentId;
  }

  return { receiptTransferDate, receiptTransferTime, operationId };
}
