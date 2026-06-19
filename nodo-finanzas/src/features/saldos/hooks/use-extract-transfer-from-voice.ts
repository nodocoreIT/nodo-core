import { useAiStore } from "@/hooks/use-ai-settings";
import type { Cuenta } from "@/types";

export interface ExtractedTransfer {
  cuentaOrigenId: string;
  cuentaDestinoId: string;
  monto: number;
  descripcion?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message: string };
}

function buildSystemPrompt(cuentas: Cuenta[]): string {
  const lista = cuentas
    .map((c) => `- id: "${c.id}", nombre: "${c.nombre}", moneda: ${c.moneda}`)
    .join("\n");

  return `Sos un asistente de finanzas personales en Argentina.
El usuario dicta una transferencia de dinero entre sus cuentas (salida en origen, entrada en destino).

Cuentas disponibles:
${lista}

Devolvé SOLO un objeto JSON válido (sin markdown) con:
- cuentaOrigenId: string (id exacto de la cuenta de origen)
- cuentaDestinoId: string (id exacto de la cuenta destino)
- monto: number (solo número, sin símbolos; "doscientos mil" → 200000)
- descripcion: string opcional (breve, ej. "Transferencia Mercado Pago → Santander")

Reglas:
- cuentaOrigenId y cuentaDestinoId deben ser distintos y existir en la lista.
- Si el usuario dice "desde X hacia Y", X es origen e Y es destino.
- Mercado Pago / MP → cuenta virtual con ese nombre.
- "caja de ahorro Santander" → cuenta con Santander en el nombre.
- Si no podés identificar ambas cuentas con certeza, devolvé {"error":"no_match"}.
- No devuelvas nada más que el JSON.`;
}

async function callGemini(
  apiKey: string,
  transcript: string,
  cuentas: Cuenta[],
): Promise<ExtractedTransfer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          { text: buildSystemPrompt(cuentas) },
          { text: `Texto dictado: "${transcript}"` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 256,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data: GeminiResponse = await res.json();

  if (!res.ok) {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Gemini API error: ${msg}`);
  }

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  if (parsed.error === "no_match") {
    throw new Error("NO_MATCH");
  }

  const cuentaOrigenId = String(parsed.cuentaOrigenId ?? "");
  const cuentaDestinoId = String(parsed.cuentaDestinoId ?? "");
  const monto = Number(parsed.monto);

  if (!cuentaOrigenId || !cuentaDestinoId || !Number.isFinite(monto) || monto <= 0) {
    throw new Error("INVALID_PARSE");
  }

  const ids = new Set(cuentas.map((c) => c.id));
  if (!ids.has(cuentaOrigenId) || !ids.has(cuentaDestinoId)) {
    throw new Error("INVALID_IDS");
  }

  if (cuentaOrigenId === cuentaDestinoId) {
    throw new Error("SAME_ACCOUNT");
  }

  const origen = cuentas.find((c) => c.id === cuentaOrigenId);
  const destino = cuentas.find((c) => c.id === cuentaDestinoId);
  if (origen && destino && origen.moneda !== destino.moneda) {
    throw new Error("CURRENCY_MISMATCH");
  }

  return {
    cuentaOrigenId,
    cuentaDestinoId,
    monto,
    descripcion:
      typeof parsed.descripcion === "string" && parsed.descripcion.trim()
        ? parsed.descripcion.trim()
        : undefined,
  };
}

export function useExtractTransferFromVoice() {
  const apiKey = useAiStore((s) => s.aiSettings.geminiApiKey);

  const extract = async (transcript: string, cuentas: Cuenta[]): Promise<ExtractedTransfer> => {
    if (!apiKey) throw new Error("NO_API_KEY");
    if (!transcript.trim()) throw new Error("EMPTY_TRANSCRIPT");
    if (cuentas.length < 2) throw new Error("NEED_TWO_ACCOUNTS");
    return callGemini(apiKey, transcript, cuentas);
  };

  return { extract, hasApiKey: !!apiKey };
}
