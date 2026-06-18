import type {
  IdentityVerificationInput,
  IdentityVerificationProvider,
  IdentityVerificationResult,
} from "../types";

type AiAnalysis = {
  person_visible?: boolean;
  document_visible?: boolean;
  face_on_document_visible?: boolean;
  same_person?: boolean;
  confidence?: number;
  notes?: string;
};

const APPROVE_THRESHOLD = 0.72;

export function createAiVisionProvider(apiKey: string, model = "gpt-4o-mini"): IdentityVerificationProvider {
  return {
    name: "ai_vision",

    async verify(input: IdentityVerificationInput): Promise<IdentityVerificationResult> {
      if (!input.holdingIdPhoto.length) {
        return {
          status: "declined",
          outcomeCode: "PHOTO_MISSING",
          provider: "ai_vision",
          message: "Subí una foto sosteniendo tu DNI junto a tu rostro.",
        };
      }

      const base64 = input.holdingIdPhoto.toString("base64");
      const mime = input.photoMimeType || "image/jpeg";
      const expectedName = `${input.firstName} ${input.lastName}`.trim();

      const prompt = `Analizá esta foto de verificación de identidad para registro profesional en Argentina.
La persona debería estar sosteniendo su DNI/documento junto a su rostro.

Nombre declarado: "${expectedName}"

Respondé SOLO con JSON válido (sin markdown):
{
  "person_visible": boolean,
  "document_visible": boolean,
  "face_on_document_visible": boolean,
  "same_person": boolean,
  "confidence": number entre 0 y 1,
  "notes": "breve explicación en español"
}

Criterios:
- person_visible: se ve claramente el rostro de una persona
- document_visible: se ve un documento de identidad (DNI argentino u otro)
- face_on_document_visible: se distingue una foto en el documento
- same_person: el rostro en vivo parece ser la misma persona que la foto del documento
- confidence: tu confianza en same_person (0 a 1)`;

      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: { url: `data:${mime};base64,${base64}`, detail: "low" },
                  },
                ],
              },
            ],
          }),
        });

        const payload = (await res.json()) as {
          error?: { message?: string };
          choices?: { message?: { content?: string } }[];
        };

        if (!res.ok) {
          return {
            status: "error",
            outcomeCode: "AI_API_ERROR",
            provider: "ai_vision",
            message: payload.error?.message ?? "Error al analizar la foto.",
            raw: payload,
          };
        }

        const content = payload.choices?.[0]?.message?.content ?? "{}";
        const analysis = JSON.parse(content) as AiAnalysis;
        const confidence = typeof analysis.confidence === "number" ? analysis.confidence : 0;

        if (!analysis.person_visible || !analysis.document_visible) {
          return {
            status: "declined",
            outcomeCode: "PHOTO_INCOMPLETE",
            provider: "ai_vision",
            faceMatchScore: confidence,
            message:
              analysis.notes ??
              "La foto debe mostrar tu rostro y el documento claramente, sosteniendo el DNI al lado de la cara.",
            raw: analysis,
          };
        }

        if (analysis.same_person && confidence >= APPROVE_THRESHOLD) {
          return {
            status: "approved",
            outcomeCode: "AI_FACE_MATCH",
            provider: "ai_vision",
            faceMatchScore: confidence,
            message: "Identidad verificada: el rostro coincide con el documento.",
            raw: analysis,
          };
        }

        if (!analysis.face_on_document_visible || confidence < 0.4) {
          return {
            status: "review",
            outcomeCode: "AI_UNCERTAIN",
            provider: "ai_vision",
            faceMatchScore: confidence,
            message:
              analysis.notes ??
              "No pudimos confirmar automáticamente. Un administrador revisará tu foto.",
            raw: analysis,
          };
        }

        return {
          status: "review",
          outcomeCode: "AI_REVIEW_REQUIRED",
          provider: "ai_vision",
          faceMatchScore: confidence,
          message:
            analysis.notes ??
            "Verificación parcial. Un administrador completará la revisión.",
          raw: analysis,
        };
      } catch (err) {
        console.error("ai_vision verify:", err);
        return {
          status: "error",
          outcomeCode: "AI_ERROR",
          provider: "ai_vision",
          message: "Error al procesar la verificación. Intentá de nuevo.",
        };
      }
    },
  };
}
