import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  evaluatePaymentReceiptChecks,
  formatAppointmentSlotLabel,
  isAllowedReceiptMime,
  isStrictPaymentValidation,
  type PaymentReceiptChecks,
} from "@/lib/clinic/payment-validation";
import {
  extractPdfVisibleText,
  parseTransferReceiptText,
} from "@/lib/clinic/receipt-text-parse";

export interface PaymentReceiptValidationInput {
  imageBase64: string;
  mimeType: string;
  fileName?: string;
  doctorName: string;
  doctorAlias?: string;
  doctorCbu?: string;
  beneficiaryName?: string;
  expectedAmount: number;
  currency: string;
  appointmentDateIso: string;
  slotDurationMinutes?: number;
}

export interface PaymentReceiptValidationResult {
  valid: boolean;
  confidence: number;
  reasons: string[];
  strictMode: boolean;
  checks?: PaymentReceiptChecks;
  extracted?: {
    amount?: number;
    date?: string;
    recipient?: string;
    payerName?: string;
    payerNote?: string;
    operationId?: string;
    time?: string;
  };
}

const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro",
];

type GeminiParse = {
  amount?: number | null;
  date?: string | null;
  time?: string | null;
  recipient?: string | null;
  cbu?: string | null;
  payerName?: string | null;
  doctorMentioned?: boolean;
  looksLikeTransferReceipt?: boolean;
  amountMatches?: boolean;
  scheduleMatches?: boolean;
  recipientMatches?: boolean;
  confidence?: number;
  notes?: string;
  operationId?: string | null;
};

function buildGeminiPrompt(input: PaymentReceiptValidationInput, slotLabel: string) {
  return `Sos un auditor de pagos de telemedicina en Argentina. Analizá la imagen/PDF de comprobante de transferencia o pago móvil.

Turno que el paciente quiere confirmar:
- Fecha y hora del turno: ${slotLabel}
- Médico: ${input.doctorName}
- Alias esperado del destinatario: ${input.doctorAlias || "no indicado"}
- CBU esperado: ${input.doctorCbu || "no indicado"}
- Titular de la cuenta esperado: ${input.beneficiaryName || "no indicado"}
- Monto esperado: ${input.currency} ${input.expectedAmount}

Reglas estrictas (todas deben cumplirse para aprobar):
- looksLikeTransferReceipt: true solo si es un comprobante bancario o de billetera real.
- amountMatches: monto transferido = honorario (tolerancia 2% o $150 ARS).
- recipientMatches: alias, CBU, titular de cuenta destino o nombre del destinatario coincide con los datos del médico.
- scheduleMatches: la FECHA del comprobante es el mismo día del turno o hasta 30 días antes. La hora del pago NO tiene que coincidir con el horario del turno (el paciente paga por adelantado).
- Extraé "time" en formato HH:mm si aparece en el comprobante.
- Extraé "cbu" si aparece (22 dígitos).
- Extraé "operationId" si aparece (id Op, nº de operación, código de transacción).
- confidence: 0-100 según claridad y coincidencia.

Respondé ÚNICAMENTE JSON válido:
{
  "amount": number o null,
  "date": "YYYY-MM-DD o null",
  "time": "HH:mm o null",
  "recipient": "alias o destinatario detectado o null",
  "cbu": "CBU destino 22 dígitos o null",
  "payerName": "nombre de quien transfirió o titular origen o null",
  "operationId": "número o código de operación o null",
  "doctorMentioned": boolean,
  "looksLikeTransferReceipt": boolean,
  "amountMatches": boolean,
  "scheduleMatches": boolean,
  "recipientMatches": boolean,
  "confidence": number,
  "notes": "breve explicación en español"
}`;
}

function resultFromParsed(
  input: PaymentReceiptValidationInput,
  parsed: GeminiParse,
  strictMode: boolean,
  sourceNote?: string,
): PaymentReceiptValidationResult {
  const { checks, valid, confidence } = evaluatePaymentReceiptChecks(
    {
      doctorName: input.doctorName,
      doctorAlias: input.doctorAlias,
      doctorCbu: input.doctorCbu,
      beneficiaryName: input.beneficiaryName,
      expectedAmount: input.expectedAmount,
      currency: input.currency,
      appointmentDateIso: input.appointmentDateIso,
      mimeType: input.mimeType,
      slotDurationMinutes: input.slotDurationMinutes,
    },
    { ...parsed, looksLikeTransferReceipt: parsed.looksLikeTransferReceipt ?? true },
  );

  const reasons = [
    checks.amount.detail,
    checks.recipient.detail,
    checks.schedule.detail,
    checks.receiptType.detail,
  ];
  if (parsed.notes) reasons.push(parsed.notes);
  if (sourceNote) reasons.push(sourceNote);
  if (!valid && strictMode) {
    reasons.push(
      "Revisá monto, destinatario y fecha del comprobante antes de continuar.",
    );
  }

  return {
    valid,
    confidence: valid ? Math.max(confidence, 88) : confidence,
    strictMode,
    checks,
    reasons,
    extracted: {
      amount: parsed.amount ?? undefined,
      date: parsed.date ?? undefined,
      recipient: parsed.recipient ?? undefined,
      payerName: parsed.payerName ?? undefined,
      operationId: parsed.operationId ?? undefined,
      time: parsed.time ?? undefined,
    },
  };
}

/** Google AI Studio keys look like AIza… — reject other tokens early. */
function resolveGeminiApiKey(): string | null {
  const raw = process.env.GEMINI_API_KEY?.trim();
  if (!raw) return null;
  if (!raw.startsWith("AIza")) {
    console.warn(
      "[payment-receipt] GEMINI_API_KEY no parece una key de Google AI Studio (debe empezar con AIza…)",
    );
    return null;
  }
  return raw;
}

function isMockPaymentReceiptEnabled(): boolean {
  return (
    process.env.CLINIC_MOCK_PAYMENT_RECEIPT === "true" ||
    process.env.NEXT_PUBLIC_CLINIC_MOCK_PAYMENT_RECEIPT === "true"
  );
}

/**
 * Texto de un comprobante real de prueba (transferencia ARS 100 → TOULEMONDE…).
 * Sirve para ejercitar la comparación monto/CBU/titular/fecha sin Gemini.
 */
export const MOCK_TRANSFER_RECEIPT_TEXT = [
  "Comprobante de Transferencia",
  "Fecha y hora 21 de julio 2026 - 08:10hs",
  "Monto debitado $100,00",
  "Cuenta destino TOULEMONDE RAMIRO SANTIAGO",
  "CBU destino 0720102488000038115640",
  "CUIT destino 20286603867",
  "Nombre remitente Juan Esteban Mendia",
  "Concepto VAR",
  "id Op. WY7ZEPN6YMR6GKM42Q0M51",
].join(" ");

function resultFromReceiptText(
  input: PaymentReceiptValidationInput,
  text: string,
  strictMode: boolean,
  sourceNote: string,
): PaymentReceiptValidationResult | null {
  if (text.length < 20) return null;
  const extracted = parseTransferReceiptText(text);
  if (!extracted.amount && !extracted.recipient && !extracted.date && !extracted.cbu) {
    return null;
  }

  return resultFromParsed(
    input,
    {
      amount: extracted.amount ?? null,
      date: extracted.date ?? null,
      time: extracted.time ?? null,
      recipient: extracted.recipient ?? null,
      cbu: extracted.cbu ?? null,
      payerName: extracted.payerName ?? null,
      operationId: extracted.operationId ?? null,
      looksLikeTransferReceipt: true,
      confidence: 90,
      notes: sourceNote,
    },
    strictMode,
    sourceNote,
  );
}

async function tryGeminiParse(
  apiKey: string,
  input: PaymentReceiptValidationInput,
  slotLabel: string,
): Promise<GeminiParse | null> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const base64 = input.imageBase64.replace(/^data:[^;]+;base64,/, "");
  const prompt = buildGeminiPrompt(input, slotLabel);
  const parts = [
    { inlineData: { mimeType: input.mimeType, data: base64 } },
    { text: prompt },
  ];

  let lastError: unknown;
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(parts);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      return JSON.parse(jsonMatch[0]) as GeminiParse;
    } catch (err) {
      lastError = err;
      console.warn(`[payment-receipt] model ${modelName} failed`, err);
      const msg = err instanceof Error ? err.message : String(err);
      if (/API_KEY_INVALID|API key not valid/i.test(msg)) {
        throw err;
      }
    }
  }
  throw lastError ?? new Error("Ningún modelo de IA respondió");
}

function tryTextParseFallback(
  input: PaymentReceiptValidationInput,
  strictMode: boolean,
): PaymentReceiptValidationResult | null {
  const isPdf =
    input.mimeType.toLowerCase() === "application/pdf" ||
    (input.fileName ?? "").toLowerCase().endsWith(".pdf");
  if (!isPdf) return null;

  const text = extractPdfVisibleText(input.imageBase64);
  return resultFromReceiptText(
    input,
    text,
    strictMode,
    "Comprobante leído del PDF (sin IA)",
  );
}

function tryMockReceiptFallback(
  input: PaymentReceiptValidationInput,
  strictMode: boolean,
): PaymentReceiptValidationResult | null {
  if (!isMockPaymentReceiptEnabled()) return null;
  return resultFromReceiptText(
    input,
    MOCK_TRANSFER_RECEIPT_TEXT,
    strictMode,
    "Mock local: datos del comprobante de prueba (sin Gemini)",
  );
}

export async function validatePaymentReceipt(
  input: PaymentReceiptValidationInput,
): Promise<PaymentReceiptValidationResult> {
  const strictMode = isStrictPaymentValidation();
  const slotLabel = formatAppointmentSlotLabel(input.appointmentDateIso);

  if (!isAllowedReceiptMime(input.mimeType)) {
    return {
      valid: false,
      confidence: 0,
      strictMode,
      reasons: [
        "Formato no admitido. Subí una imagen (JPG/PNG) o PDF del comprobante.",
      ],
    };
  }

  const apiKey = resolveGeminiApiKey();

  if (!apiKey) {
    const textFallback = tryTextParseFallback(input, strictMode);
    if (textFallback) return textFallback;
    const mockFallback = tryMockReceiptFallback(input, strictMode);
    if (mockFallback) return mockFallback;
    return validatePaymentReceiptHeuristic(input, strictMode);
  }

  try {
    const parsed = await tryGeminiParse(apiKey, input, slotLabel);
    if (!parsed) {
      return {
        valid: false,
        confidence: 0,
        strictMode,
        reasons: ["No se pudo leer el comprobante automáticamente"],
      };
    }
    return resultFromParsed(input, parsed, strictMode);
  } catch (err) {
    console.error("[payment-receipt] Gemini error", err);
    const textFallback = tryTextParseFallback(input, strictMode);
    if (textFallback) return textFallback;
    const mockFallback = tryMockReceiptFallback(input, strictMode);
    if (mockFallback) return mockFallback;

    const fallback = validatePaymentReceiptHeuristic(input, strictMode);
    if (!strictMode || fallback.valid) return fallback;

    const geminiHint = /API_KEY_INVALID|API key not valid/i.test(
      err instanceof Error ? err.message : String(err),
    )
      ? "GEMINI_API_KEY inválida: usá una key de Google AI Studio (empieza con AIza…)"
      : "Verificá GEMINI_API_KEY o activá CLINIC_MOCK_PAYMENT_RECEIPT=true en local";

    return {
      ...fallback,
      valid: false,
      reasons: [
        "No se pudo analizar el comprobante con IA",
        geminiHint,
        "Probá subir una captura JPG/PNG del comprobante",
      ],
    };
  }
}

function validatePaymentReceiptHeuristic(
  input: PaymentReceiptValidationInput,
  strictMode: boolean,
): PaymentReceiptValidationResult {
  const textFallback = tryTextParseFallback(input, strictMode);
  if (textFallback) return textFallback;

  const fileName = (input.fileName ?? "").toLowerCase();
  const amountFromName = extractLargestNumber(fileName);
  const amountPass =
    input.expectedAmount <= 0 ||
    (amountFromName > 0 &&
      Math.abs(amountFromName - input.expectedAmount) <=
        Math.max(input.expectedAmount * 0.05, 500));

  const aliasHints = [
    input.doctorAlias,
    input.doctorCbu,
    input.beneficiaryName,
    input.doctorName,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().replace(/\./g, ""));
  const aliasMatches = aliasHints.some(
    (hint) => hint.length >= 4 && fileName.includes(hint.slice(0, 8)),
  );

  if (amountPass && aliasMatches) {
    return {
      valid: true,
      confidence: 90,
      strictMode,
      reasons: [
        "Monto del comprobante coincide con el honorario",
        "Destinatario compatible con los datos del médico",
      ],
      extracted: { amount: amountFromName },
    };
  }

  if (!strictMode) {
    const slotLabel = formatAppointmentSlotLabel(input.appointmentDateIso);
    return {
      valid: true,
      confidence: 80,
      strictMode,
      checks: {
        amount: {
          pass: true,
          detail:
            input.expectedAmount > 0
              ? `Monto esperado: ${input.currency} ${input.expectedAmount.toLocaleString("es-AR")} (demo)`
              : "Sin honorario configurado",
        },
        recipient: {
          pass: true,
          detail: input.doctorAlias
            ? `Alias del médico: ${input.doctorAlias} (demo)`
            : "Destinatario — validación relajada en demo",
        },
        schedule: {
          pass: true,
          detail: `Turno: ${slotLabel} (demo)`,
        },
        receiptType: {
          pass: true,
          detail: "Comprobante recibido",
        },
      },
      reasons: [
        "Comprobante registrado (modo demo / local)",
        !process.env.GEMINI_API_KEY
          ? "En producción se valida monto, destinatario y horario con IA"
          : "",
      ].filter(Boolean),
      extracted: { amount: input.expectedAmount },
    };
  }

  const reasons: string[] = [
    "No se pudo validar el comprobante automáticamente",
    "Subí una imagen o PDF legible del comprobante de transferencia",
  ];
  if (input.doctorAlias) reasons.push(`Alias esperado: ${input.doctorAlias}`);
  if (input.beneficiaryName) {
    reasons.push(`Titular esperado: ${input.beneficiaryName}`);
  }
  if (input.expectedAmount > 0) {
    reasons.push(
      `Honorario esperado: ${input.currency} ${input.expectedAmount.toLocaleString("es-AR")}`,
    );
  }
  reasons.push("Si el comprobante es correcto, el médico puede confirmarlo manualmente.");

  return {
    valid: false,
    confidence: 20,
    strictMode,
    reasons,
    extracted: { amount: amountFromName || undefined },
  };
}

function extractLargestNumber(text: string): number {
  const matches = text.match(/\d{4,}/g);
  if (!matches?.length) return 0;
  return Math.max(...matches.map((m) => Number(m)));
}
