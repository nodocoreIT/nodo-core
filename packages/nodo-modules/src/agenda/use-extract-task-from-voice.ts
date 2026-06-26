import type { AiProvider } from "./types";

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

export interface ExtractedTask {
  title?: string;
  description?: string;
  priority?: "alta" | "media" | "baja";
  due_date?: string; // YYYY-MM-DD
  assigned_to?: string;
  category?: string;
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildSystemPrompt(today: string): string {
  return `Sos un asistente de gestión de tareas para una empresa argentina.
La fecha de hoy es ${today}.
Extraé los datos de la tarea del texto dictado y devolvé SOLO un objeto JSON válido (sin markdown, sin backticks) con estas claves cuando puedas inferirlas:
- title: string (título breve de la tarea, requerido)
- description: string (descripción o detalles adicionales, si los hay)
- priority: "alta" | "media" | "baja" (urgente/importante→alta, normal→media, cuando puedas→baja; por defecto "media" si no se indica)
- due_date: string en formato YYYY-MM-DD (resolvé fechas relativas como "mañana", "el viernes", "la próxima semana" usando la fecha de hoy como referencia)
- assigned_to: string (nombre de la persona asignada, si se menciona)
- category: string (categoría libre o la que mejor encaje con el contexto del dictado)
Omití las claves que no puedas inferir. No devuelvas absolutamente nada más que el JSON puro.`;
}

// ── Parse helper ──────────────────────────────────────────────────────────────

function parseExtractedTask(raw: string): ExtractedTask {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const result: ExtractedTask = {};

  if (typeof parsed.title === "string" && parsed.title.trim()) {
    result.title = parsed.title.trim();
  }
  if (typeof parsed.description === "string" && parsed.description.trim()) {
    result.description = parsed.description.trim();
  }
  if (
    parsed.priority === "alta" ||
    parsed.priority === "media" ||
    parsed.priority === "baja"
  ) {
    result.priority = parsed.priority;
  }
  if (typeof parsed.due_date === "string") {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(parsed.due_date)) {
      const d = new Date(`${parsed.due_date}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        result.due_date = parsed.due_date;
      }
    }
  }
  if (typeof parsed.assigned_to === "string" && parsed.assigned_to.trim()) {
    result.assigned_to = parsed.assigned_to.trim();
  }
  if (typeof parsed.category === "string" && parsed.category.trim()) {
    result.category = parsed.category.trim();
  }

  return result;
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function callGemini(apiKey: string, transcript: string): Promise<ExtractedTask> {
  const today = new Date().toISOString().split("T")[0];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          { text: buildSystemPrompt(today) },
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
  return parseExtractedTask(raw);
}

async function callOpenAI(apiKey: string, transcript: string): Promise<ExtractedTask> {
  const today = new Date().toISOString().split("T")[0];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildSystemPrompt(today) },
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
  return parseExtractedTask(raw);
}

async function callAnthropic(apiKey: string, transcript: string): Promise<ExtractedTask> {
  const today = new Date().toISOString().split("T")[0];
  const systemPrompt = buildSystemPrompt(today);

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
          content: `${systemPrompt}\n\nTexto dictado: "${transcript}"`,
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
  return parseExtractedTask(raw);
}

async function callAI(provider: AiProvider, apiKey: string, transcript: string): Promise<ExtractedTask> {
  if (provider === "openai") return callOpenAI(apiKey, transcript);
  if (provider === "anthropic") return callAnthropic(apiKey, transcript);
  return callGemini(apiKey, transcript);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useExtractTaskFromVoice(
  apiKey: string | null | undefined,
  provider: AiProvider = "gemini",
) {
  const extract = async (transcript: string): Promise<ExtractedTask> => {
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
