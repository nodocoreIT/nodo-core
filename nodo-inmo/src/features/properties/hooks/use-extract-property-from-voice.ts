import { useSettingsModule, getActiveApiKey } from "@nodocore/nodo-modules/settings";
import type { AiProvider } from "@nodocore/nodo-modules/settings";
import type { PropertyFormValues } from "@/features/properties/components/property-form-dialog";
import { formatCurrencyInput } from "@/shared/lib/format-money";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message: string };
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message: string };
}

interface AnthropicResponse {
  content?: Array<{ text?: string }>;
  error?: { message: string };
}

type ExtractedValues = Partial<PropertyFormValues>;

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sos un asistente de una inmobiliaria argentina.
Extraé los datos de la propiedad del texto y devolvé SOLO un objeto JSON válido (sin markdown, sin backticks) con estas claves cuando puedas inferirlas:
- address: string (dirección completa, ej: "Levenson 3980")
- operation: "rent" o "sale" (alquiler → rent, venta → sale)
- property_type: "apartment" | "house" | "commercial" | "land" | "other" (departamento→apartment, casa→house, local/comercial→commercial, terreno→land)
- status: "available" | "reserved" | "rented" | "sold" | "inactive" (disponible por defecto si no se indica)
- currency: "ARS" o "USD" (pesos→ARS, dólares/dolares→USD, por defecto ARS si no se indica)
- sale_price: number (solo el número entero, sin símbolos ni puntos, ej: 35000)
- rooms: number (cantidad de ambientes)
- total_sqm: number (metros cuadrados)
- description: string (descripción libre si hubiera)
Omití las claves que no puedas inferir. No devuelvas absolutamente nada más que el JSON puro.`;

// ── Parse helper ──────────────────────────────────────────────────────────────

function parseExtractedValues(raw: string): ExtractedValues {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const result: ExtractedValues = {};

  if (typeof parsed.address === "string") result.address = parsed.address;
  if (parsed.operation === "rent" || parsed.operation === "sale")
    result.operation = parsed.operation;
  if (
    ["apartment", "house", "commercial", "land", "other"].includes(
      parsed.property_type as string,
    )
  )
    result.property_type = parsed.property_type as PropertyFormValues["property_type"];
  if (
    ["available", "reserved", "rented", "sold", "inactive"].includes(
      parsed.status as string,
    )
  )
    result.status = parsed.status as PropertyFormValues["status"];
  if (parsed.currency === "ARS" || parsed.currency === "USD")
    result.currency = parsed.currency;
  if (typeof parsed.sale_price === "number" && parsed.sale_price > 0) {
    const currency = result.currency ?? "ARS";
    result.sale_price = formatCurrencyInput(
      String(Math.round(parsed.sale_price)),
      currency,
    );
  }
  if (typeof parsed.rooms === "number")
    result.rooms = String(parsed.rooms);
  if (typeof parsed.total_sqm === "number")
    result.total_sqm = String(parsed.total_sqm);
  if (typeof parsed.description === "string" && parsed.description)
    result.description = parsed.description;

  return result;
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function callGemini(
  apiKey: string,
  transcript: string,
): Promise<ExtractedValues> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          { text: `Texto dictado: "${transcript}"` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 512,
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
  return parseExtractedValues(raw);
}

async function callOpenAI(
  apiKey: string,
  transcript: string,
): Promise<ExtractedValues> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Texto dictado: "${transcript}"` },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  const data: OpenAIResponse = await res.json();

  if (!res.ok) {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`OpenAI API error: ${msg}`);
  }

  const raw = data.choices?.[0]?.message?.content ?? "";
  return parseExtractedValues(raw);
}

async function callAnthropic(
  apiKey: string,
  transcript: string,
): Promise<ExtractedValues> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `${SYSTEM_PROMPT}\n\nTexto dictado: "${transcript}"`,
        },
      ],
    }),
  });

  const data: AnthropicResponse = await res.json();

  if (!res.ok) {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Anthropic API error: ${msg}`);
  }

  const raw = data.content?.[0]?.text ?? "";
  return parseExtractedValues(raw);
}

async function callAI(
  provider: AiProvider,
  apiKey: string,
  transcript: string,
): Promise<ExtractedValues> {
  if (provider === "openai") return callOpenAI(apiKey, transcript);
  if (provider === "anthropic") return callAnthropic(apiKey, transcript);
  return callGemini(apiKey, transcript);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useExtractPropertyFromVoice() {
  const { aiSettings } = useSettingsModule();
  const apiKey = getActiveApiKey(aiSettings);
  const provider = aiSettings.provider;

  const extract = async (transcript: string): Promise<ExtractedValues> => {
    if (!apiKey) {
      throw new Error("NO_API_KEY");
    }
    if (!transcript.trim()) {
      throw new Error("EMPTY_TRANSCRIPT");
    }
    return callAI(provider, apiKey, transcript);
  };

  return { extract, hasApiKey: !!apiKey };
}
