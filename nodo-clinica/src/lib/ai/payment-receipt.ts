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
  if (text.length < 20) return null;

  const extracted = parseTransferReceiptText(text);
  if (!extracted.amount && !extracted.recipient && !extracted.date) return null;

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
      confidence: 85,
      notes: "Comprobante leído del PDF (sin IA)",
    },
    strictMode,
    "Validación por lectura directa del PDF",
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

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const textFallback = tryTextParseFallback(input, strictMode);
    if (textFallback) return textFallback;
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

    const fallback = validatePaymentReceiptHeuristic(input, strictMode);
    if (!strictMode || fallback.valid) return fallback;

    return {
      ...fallback,
      valid: false,
      reasons: [
        "No se pudo analizar el comprobante con IA",
        err instanceof Error ? err.message : "Error de servicio de IA",
        "Probá subir una captura JPG/PNG del comprobante",
        "Verificá que GEMINI_API_KEY esté configurada en Vercel",
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
      valid: false,
      confidence: 35,
      strictMode,
      checks: {
        amount: {
          pass: false,
          detail:
            input.expectedAmount > 0
              ? `No se detectó monto ${input.currency} ${input.expectedAmount.toLocaleString("es-AR")} en el archivo — el médico debe revisar`
              : "Sin honorario configurado",
        },
        recipient: {
          pass: false,
          detail: "Destinatario no verificado automáticamente",
        },
        schedule: {
          pass: false,
          detail: `Turno: ${slotLabel} — fecha del comprobante sin confirmar`,
        },
        receiptType: {
          pass: true,
          detail: "Comprobante recibido — revisión manual",
        },
      },
      reasons: [
        "Comprobante guardado para revisión del médico",
        "En modo local sin lectura automática no se aprueba el pago solo",
        !process.env.GEMINI_API_KEY
          ? "Configurá GEMINI_API_KEY para validación automática de monto y destinatario"
          : "",
      ].filter(Boolean),
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
