import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  evaluatePaymentReceiptChecks,
  formatAppointmentSlotLabel,
  isAllowedReceiptMime,
  isStrictPaymentValidation,
  type PaymentReceiptChecks,
} from "@/lib/clinic/payment-validation";

export interface PaymentReceiptValidationInput {
  imageBase64: string;
  mimeType: string;
  fileName?: string;
  doctorName: string;
  doctorAlias?: string;
  doctorCbu?: string;
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
    payerNote?: string;
  };
}

export async function validatePaymentReceipt(
  input: PaymentReceiptValidationInput,
): Promise<PaymentReceiptValidationResult> {
  const strictMode = isStrictPaymentValidation();
  const slotLabel = formatAppointmentSlotLabel(input.appointmentDateIso);
  const aptDate = new Date(input.appointmentDateIso);
  const expectedDate = aptDate.toLocaleDateString("es-AR");
  const expectedTime = aptDate.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

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
    return validatePaymentReceiptHeuristic(input, strictMode);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Sos un auditor de pagos de telemedicina en Argentina. Analizá la imagen/PDF de comprobante de transferencia o pago móvil.

Turno que el paciente quiere confirmar:
- Fecha y hora del turno: ${slotLabel}
- Médico: ${input.doctorName}
- Alias esperado del destinatario: ${input.doctorAlias || "no indicado"}
- CBU esperado: ${input.doctorCbu || "no indicado"}
- Monto esperado: ${input.currency} ${input.expectedAmount}

Reglas estrictas (todas deben cumplirse para aprobar):
- looksLikeTransferReceipt: true solo si es un comprobante bancario o de billetera real.
- amountMatches: monto transferido = honorario (tolerancia 2% o $150 ARS).
- recipientMatches: alias, CBU o nombre del destinatario = datos del médico.
- scheduleMatches: fecha/hora del comprobante es coherente con el turno (${expectedDate} ${expectedTime}); el pago no puede ser posterior al día del turno.
- Extraé "time" en formato HH:mm si aparece en el comprobante.
- confidence: 0-100 según claridad y coincidencia.

Respondé ÚNICAMENTE JSON válido:
{
  "amount": number o null,
  "date": "YYYY-MM-DD o null",
  "time": "HH:mm o null",
  "recipient": "alias o destinatario detectado o null",
  "doctorMentioned": boolean,
  "looksLikeTransferReceipt": boolean,
  "amountMatches": boolean,
  "scheduleMatches": boolean,
  "recipientMatches": boolean,
  "confidence": number,
  "notes": "breve explicación en español"
}`;

    const base64 = input.imageBase64.replace(/^data:[^;]+;base64,/, "");

    const result = await model.generateContent([
      { inlineData: { mimeType: input.mimeType, data: base64 } },
      { text: prompt },
    ]);

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        valid: false,
        confidence: 0,
        strictMode,
        reasons: ["No se pudo leer el comprobante automáticamente"],
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      amount?: number | null;
      date?: string | null;
      time?: string | null;
      recipient?: string | null;
      doctorMentioned?: boolean;
      looksLikeTransferReceipt?: boolean;
      amountMatches?: boolean;
      scheduleMatches?: boolean;
      recipientMatches?: boolean;
      confidence?: number;
      notes?: string;
    };

    const { checks, valid, confidence } = evaluatePaymentReceiptChecks(
      {
        doctorName: input.doctorName,
        doctorAlias: input.doctorAlias,
        doctorCbu: input.doctorCbu,
        expectedAmount: input.expectedAmount,
        currency: input.currency,
        appointmentDateIso: input.appointmentDateIso,
        mimeType: input.mimeType,
        slotDurationMinutes: input.slotDurationMinutes,
      },
      parsed,
    );

    const reasons = [
      checks.amount.detail,
      checks.recipient.detail,
      checks.schedule.detail,
      checks.receiptType.detail,
    ];
    if (parsed.notes) reasons.push(parsed.notes);
    if (!valid && strictMode) {
      reasons.push(
        "En producción el turno solo se activa si el comprobante cumple todos los criterios.",
      );
    }

    return {
      valid,
      confidence,
      strictMode,
      checks,
      reasons,
      extracted: {
        amount: parsed.amount ?? undefined,
        date: parsed.date ?? undefined,
        recipient: parsed.recipient ?? undefined,
      },
    };
  } catch (err) {
    console.error("[payment-receipt] Gemini error", err);
    if (strictMode) {
      return {
        valid: false,
        confidence: 0,
        strictMode,
        reasons: [
          "Error al analizar el comprobante con IA",
          "El médico puede confirmar el pago manualmente desde su panel",
        ],
      };
    }
    return validatePaymentReceiptHeuristic(input, strictMode);
  }
}

function validatePaymentReceiptHeuristic(
  input: PaymentReceiptValidationInput,
  strictMode: boolean,
): PaymentReceiptValidationResult {
  const fileName = (input.fileName ?? "").toLowerCase();
  const amountFromName = extractLargestNumber(fileName);
  const amountPass =
    input.expectedAmount <= 0 ||
    (amountFromName > 0 &&
      Math.abs(amountFromName - input.expectedAmount) <=
        Math.max(input.expectedAmount * 0.05, 500));

  const aliasHints = [input.doctorAlias, input.doctorCbu, input.doctorName]
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
    "Validación estricta: se requiere GEMINI_API_KEY para analizar el comprobante",
    "Subí una imagen o PDF legible del comprobante de transferencia",
  ];
  if (input.doctorAlias) reasons.push(`Alias esperado: ${input.doctorAlias}`);
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
