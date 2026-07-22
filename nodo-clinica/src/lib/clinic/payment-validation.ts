import { isLocalMode } from "@/lib/clinic/config";
import { parseLocalDate } from "@/lib/clinic/schedule";
import { currencySymbol } from "@/lib/clinic/currency";

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
  cbu: PaymentCheckResult;
  alias: PaymentCheckResult;
  holderName: PaymentCheckResult;
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

/** Compara CBUs ignorando espacios/guiones — 22 dígitos, sin tolerancia de mayúsc/minúsc (son números). */
export function cbuMatches(
  expected: string | null | undefined,
  extracted: string | null | undefined,
): boolean {
  const e = (expected ?? "").replace(/\D/g, "");
  const x = (extracted ?? "").replace(/\D/g, "");
  if (!e || !x) return false;
  return e === x;
}

/** Compara alias case-insensitive, ignorando puntos/espacios ("Juan.Perez" == "juan perez"). */
export function aliasMatches(
  expected: string | null | undefined,
  extracted: string | null | undefined,
): boolean {
  const e = normalizeMatchText(expected ?? "");
  const x = normalizeMatchText(extracted ?? "");
  if (!e || !x) return false;
  return e === x;
}

/**
 * Compara nombre y apellido del titular sin importar mayúsculas, acentos, ni el
 * orden de las palabras ("Juan Pérez" == "PEREZ, Juan Gabriel"). Requiere que
 * todas las palabras significativas (≥3 letras) del nombre esperado aparezcan
 * en el texto extraído — si el nombre esperado tiene una sola palabra, esa
 * sola coincidencia no alcanza (evita falsos positivos con nombres comunes).
 */
export function holderNameMatches(
  expected: string | null | undefined,
  extracted: string | null | undefined,
): boolean {
  const expectedWords = (expected ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3);
  if (expectedWords.length === 0) return false;

  const extractedText = (extracted ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (!extractedText.trim()) return false;

  const matchedWords = expectedWords.filter((w) => extractedText.includes(w));
  const requiredMatches = expectedWords.length === 1 ? 1 : 2;
  return matchedWords.length >= Math.min(requiredMatches, expectedWords.length);
}

const ES_MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

export function parseReceiptDate(
  dateStr: string | null | undefined,
): Date | null {
  if (!dateStr?.trim()) return null;
  const iso = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = parseLocalDate(`${iso[1]}-${iso[2]}-${iso[3]}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const es = dateStr.toLowerCase().match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(\d{4})/i);
  if (es) {
    const month = ES_MONTHS[es[2].normalize("NFD").replace(/\p{M}/gu, "")];
    if (month) {
      const d = parseLocalDate(
        `${es[3]}-${String(month).padStart(2, "0")}-${es[1].padStart(2, "0")}`,
      );
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  const ar = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (ar) {
    const year = ar[3].length === 2 ? `20${ar[3]}` : ar[3];
    const d = parseLocalDate(
      `${year}-${ar[2].padStart(2, "0")}-${ar[1].padStart(2, "0")}`,
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  /** Alias del destinatario tal como aparece en el comprobante (ej. "juan.perez.mp"). */
  alias?: string | null;
  /** Nombre y apellido del titular de la cuenta/alias destino. */
  holderName?: string | null;
  cbu?: string | null;
  doctorMentioned?: boolean;
  amountMatches?: boolean;
  looksLikeTransferReceipt?: boolean;
  confidence?: number;
  notes?: string;
}

export function evaluatePaymentReceiptChecks(
  input: {
    doctorName: string;
    doctorAlias?: string;
    doctorCbu?: string;
    beneficiaryName?: string;
    expectedAmount: number;
    currency: string;
    mimeType: string;
  },
  parsed: GeminiReceiptParse,
): { checks: PaymentReceiptChecks; valid: boolean; confidence: number } {
  const amountPass = amountWithinTolerance(input.expectedAmount, parsed.amount);

  // CBU: obligatorio solo si el médico tiene uno configurado — si no lo cargó,
  // no hay nada contra qué comparar y no debe bloquear la reserva.
  const cbuPass = !input.doctorCbu || cbuMatches(input.doctorCbu, parsed.cbu);

  // Alias: siempre opcional, nunca bloquea `valid` — se informa igual.
  const aliasPass =
    !input.doctorAlias || !parsed.alias || aliasMatches(input.doctorAlias, parsed.alias);

  // Nombre y apellido del titular: obligatorio. Se compara contra el titular
  // configurado por el médico, o contra su propio nombre si no cargó uno.
  const expectedHolderName = input.beneficiaryName || input.doctorName;
  const holderNamePass = holderNameMatches(expectedHolderName, parsed.holderName);

  const receiptTypePass =
    parsed.looksLikeTransferReceipt !== false &&
    isAllowedReceiptMime(input.mimeType);

  const checks: PaymentReceiptChecks = {
    amount: {
      pass: input.expectedAmount <= 0 ? true : amountPass,
      detail:
        input.expectedAmount <= 0
          ? "Sin honorario configurado"
          : amountPass
            ? `Monto coincide (${currencySymbol(input.currency)} ${parsed.amount ?? "—"})`
            : `Monto esperado: ${currencySymbol(input.currency)} ${input.expectedAmount.toLocaleString("es-AR")}${parsed.amount != null ? ` · detectado: ${parsed.amount.toLocaleString("es-AR")}` : ""}`,
    },
    cbu: {
      pass: cbuPass,
      detail: !input.doctorCbu
        ? "El médico no tiene CBU/CVU configurado"
        : cbuPass
          ? "El CBU/CVU coincide con el del médico"
          : `El CBU/CVU no coincide con el esperado (${input.doctorCbu})${parsed.cbu ? ` · detectado: ${parsed.cbu}` : " · no se detectó un CBU/CVU en el comprobante"}`,
    },
    alias: {
      pass: aliasPass,
      detail: !input.doctorAlias
        ? "El médico no tiene alias configurado"
        : !parsed.alias
          ? "No se detectó alias en el comprobante (opcional)"
          : aliasPass
            ? "El alias coincide con el del médico"
            : `El alias no coincide (esperado: ${input.doctorAlias}, detectado: ${parsed.alias}) — opcional, no bloquea`,
    },
    holderName: {
      pass: holderNamePass,
      detail: holderNamePass
        ? `El nombre del titular coincide (${expectedHolderName})`
        : `El nombre y apellido del titular no coincide con "${expectedHolderName}"${parsed.holderName ? ` (detectado: ${parsed.holderName})` : " (no se detectó un nombre en el comprobante)"}`,
    },
    receiptType: {
      pass: receiptTypePass,
      detail: receiptTypePass
        ? "Archivo reconocido como comprobante de transferencia"
        : "El archivo no parece un comprobante de pago válido",
    },
  };

  const confidence = parsed.confidence ?? 0;
  // El alias y la fecha son informativos y no participan del resultado final
  // — CBU, monto y nombre del titular sí. La fecha puede fallar por husos
  // horarios o comprobantes anticipados sin que eso implique un pago inválido.
  const valid =
    checks.amount.pass &&
    checks.cbu.pass &&
    checks.holderName.pass &&
    checks.receiptType.pass;

  return { checks, valid, confidence };
}
