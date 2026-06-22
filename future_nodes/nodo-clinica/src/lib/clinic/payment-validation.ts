import { isLocalMode } from "@/lib/clinic/config";

/** Producción: OCR obligatorio; local: permisivo salvo override. */
export function isStrictPaymentValidation(): boolean {
  if (process.env.CLINIC_RELAX_PAYMENT_VALIDATION === "true") return false;
  if (
    process.env.CLINIC_STRICT_PAYMENT_VALIDATION === "true" ||
    process.env.NEXT_PUBLIC_CLINIC_STRICT_PAYMENT === "true"
  ) {
    return true;
  }
  return !isLocalMode();
}

export interface PaymentCheckResult {
  pass: boolean;
  detail: string;
}

export interface PaymentReceiptChecks {
  amount: PaymentCheckResult;
  recipient: PaymentCheckResult;
  schedule: PaymentCheckResult;
  receiptType: PaymentCheckResult;
}

const RECEIPT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export function isAllowedReceiptMime(mimeType: string): boolean {
  return RECEIPT_MIME_TYPES.has(mimeType.toLowerCase());
}

export function amountWithinTolerance(
  expected: number,
  actual: number | null | undefined,
  tolerancePct = 0.02,
  minDiff = 150,
): boolean {
  if (expected <= 0) return true;
  if (actual == null || !Number.isFinite(actual) || actual <= 0) return false;
  return Math.abs(actual - expected) <= Math.max(expected * tolerancePct, minDiff);
}

export function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

export function recipientMatches(
  hints: {
    doctorName: string;
    doctorAlias?: string;
    doctorCbu?: string;
  },
  recipient: string | null | undefined,
): boolean {
  const target = normalizeMatchText(recipient ?? "");
  if (!target || target.length < 4) return false;

  const candidates = [
    hints.doctorAlias,
    hints.doctorCbu,
    hints.doctorName,
    ...hints.doctorName.split(/\s+/).filter((p) => p.length >= 4),
  ]
    .filter(Boolean)
    .map((s) => normalizeMatchText(String(s)));

  return candidates.some((hint) => {
    if (hint.length < 4) return false;
    if (target.includes(hint) || hint.includes(target)) return true;
    if (hint.length >= 6 && target.includes(hint.slice(0, 6))) return true;
    return false;
  });
}

export function parseReceiptDate(
  dateStr: string | null | undefined,
): Date | null {
  if (!dateStr?.trim()) return null;
  const iso = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const ar = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (ar) {
    const year = ar[3].length === 2 ? `20${ar[3]}` : ar[3];
    const d = new Date(`${year}-${ar[2].padStart(2, "0")}-${ar[1].padStart(2, "0")}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseReceiptTime(
  timeStr: string | null | undefined,
): number | null {
  if (!timeStr?.trim()) return null;
  const m = timeStr.match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Fecha/hora del pago compatible con el turno reservado. */
export function scheduleMatchesAppointmentSlot(
  appointmentIso: string,
  receiptDate: Date | null,
  receiptTimeMinutes: number | null,
  slotDurationMinutes = 30,
): boolean {
  if (!receiptDate) return false;

  const apt = new Date(appointmentIso);
  const aptDay = new Date(apt);
  aptDay.setHours(0, 0, 0, 0);
  const payDay = new Date(receiptDate);
  payDay.setHours(0, 0, 0, 0);

  if (payDay.getTime() > aptDay.getTime()) return false;

  const earliest = new Date(aptDay);
  earliest.setDate(earliest.getDate() - 30);
  if (payDay < earliest) return false;

  const sameDay = payDay.getTime() === aptDay.getTime();
  if (sameDay && receiptTimeMinutes != null) {
    const slotStart = apt.getHours() * 60 + apt.getMinutes();
    const slotEnd = slotStart + slotDurationMinutes;
    return receiptTimeMinutes >= 300 && receiptTimeMinutes <= slotEnd + 180;
  }

  return true;
}

export function formatAppointmentSlotLabel(appointmentIso: string): string {
  const d = new Date(appointmentIso);
  return d.toLocaleString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface GeminiReceiptParse {
  amount?: number | null;
  date?: string | null;
  time?: string | null;
  recipient?: string | null;
  doctorMentioned?: boolean;
  amountMatches?: boolean;
  scheduleMatches?: boolean;
  dateMatches?: boolean;
  recipientMatches?: boolean;
  looksLikeTransferReceipt?: boolean;
  confidence?: number;
  notes?: string;
}

export function evaluatePaymentReceiptChecks(
  input: {
    doctorName: string;
    doctorAlias?: string;
    doctorCbu?: string;
    expectedAmount: number;
    currency: string;
    appointmentDateIso: string;
    mimeType: string;
    slotDurationMinutes?: number;
  },
  parsed: GeminiReceiptParse,
): { checks: PaymentReceiptChecks; valid: boolean; confidence: number } {
  const strict = isStrictPaymentValidation();
  const minConfidence = strict ? 85 : 70;

  const amountPass = amountWithinTolerance(input.expectedAmount, parsed.amount);
  const recipientPass =
    recipientMatches(
      {
        doctorName: input.doctorName,
        doctorAlias: input.doctorAlias,
        doctorCbu: input.doctorCbu,
      },
      parsed.recipient,
    ) ||
    !!parsed.recipientMatches ||
    (!!parsed.doctorMentioned && strict === false);

  const receiptDate = parseReceiptDate(parsed.date ?? undefined);
  const receiptTime = parseReceiptTime(parsed.time ?? undefined);
  const schedulePass =
    scheduleMatchesAppointmentSlot(
      input.appointmentDateIso,
      receiptDate,
      receiptTime,
      input.slotDurationMinutes ?? 30,
    ) ||
    !!parsed.scheduleMatches ||
    !!parsed.dateMatches;

  const receiptTypePass =
    parsed.looksLikeTransferReceipt !== false &&
    isAllowedReceiptMime(input.mimeType);

  const slotLabel = formatAppointmentSlotLabel(input.appointmentDateIso);

  const checks: PaymentReceiptChecks = {
    amount: {
      pass: input.expectedAmount <= 0 ? true : amountPass,
      detail:
        input.expectedAmount <= 0
          ? "Sin honorario configurado"
          : amountPass
            ? `Monto coincide (${input.currency} ${parsed.amount ?? "—"})`
            : `Monto esperado: ${input.currency} ${input.expectedAmount.toLocaleString("es-AR")}${parsed.amount != null ? ` · detectado: ${parsed.amount.toLocaleString("es-AR")}` : ""}`,
    },
    recipient: {
      pass: recipientPass,
      detail: recipientPass
        ? "Destinatario coincide con el médico (alias/CBU/nombre)"
        : `No coincide con alias/CBU/nombre${input.doctorAlias ? ` (${input.doctorAlias})` : ""}`,
    },
    schedule: {
      pass: schedulePass,
      detail: schedulePass
        ? `Horario compatible con el turno (${slotLabel})`
        : `El comprobante no coincide con el turno reservado (${slotLabel})`,
    },
    receiptType: {
      pass: receiptTypePass,
      detail: receiptTypePass
        ? "Archivo reconocido como comprobante de transferencia"
        : "El archivo no parece un comprobante de pago válido",
    },
  };

  const confidence = parsed.confidence ?? 0;
  const valid =
    checks.amount.pass &&
    checks.recipient.pass &&
    checks.schedule.pass &&
    checks.receiptType.pass &&
    confidence >= minConfidence;

  return { checks, valid, confidence };
}
