import type { AiProvider } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VoicePromptOption {
  value: string;
  label: string;
}

export interface VoicePromptOptions {
  categories?: VoicePromptOption[];
  assignees?: VoicePromptOption[];
  properties?: VoicePromptOption[];
}

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
  property_id?: string;
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildSystemPrompt(today: string, options: VoicePromptOptions = {}): string {
  const todayDate = new Date(`${today}T00:00:00`);
  const dayName = todayDate.toLocaleDateString("es-AR", { weekday: "long" });

  const categorySection = options.categories?.length
    ? `- category: string — elegí EXACTAMENTE uno de estos valores según el contenido de la tarea:
${options.categories.map((c) => `  • "${c.value}" (${c.label})`).join("\n")}
  Ejemplos de inferencia: "cambiar", "reparar", "arreglar", "plomero", "electricista", "termo", "filtra", "gotea" → mantenimiento. "mostrar", "visita", "recorrida" → visita. "cobrar", "alquiler", "expensas", "pago" → cobro. "firmar", "contrato", "renovación" → firma. "trámite", "papel", "certificado", "municipio" → tramite.`
    : `- category: string (categoría libre que mejor encaje con el contexto del dictado)`;

  const assigneeSection = options.assignees?.length
    ? `- assigned_to: string — si se menciona una persona, usá EXACTAMENTE el campo value de esta lista: ${options.assignees.map((a) => `value="${a.value}" nombre="${a.label}"`).join(", ")}. Si no encontrás coincidencia clara, omití la clave (quedará Sin asignar).`
    : `- assigned_to: string (nombre de la persona asignada, si se menciona; omitir si no está claro)`;

  const propertySection = options.properties?.length
    ? `- property_id: string — si se menciona una dirección o propiedad, buscá la coincidencia más cercana en esta lista (ignorá tildes, mayúsculas y abreviaciones): ${options.properties.map((p) => `id="${p.value}" dirección="${p.label}"`).join(", ")}. Devolvé el id si encontrás coincidencia razonable; omití la clave si no hay match.`
    : ``;

  return `Sos un asistente de gestión de tareas para una inmobiliaria argentina.
Hoy es ${dayName} ${today}.
Extraé los datos de la tarea del texto dictado y devolvé SOLO un objeto JSON válido (sin markdown, sin backticks) con estas claves cuando puedas inferirlas:
- title: string (título breve y claro de la tarea — incluí la dirección o propiedad si se menciona, ej: "Cambiar termo - Lebenson 3980")
- description: string (detalles adicionales que no entran en el título)
- priority: "alta" | "media" | "baja" — urgente/crítico/roto/no funciona→alta, normal→media, cuando puedas/sin apuro→baja; por defecto "media"
- due_date: string YYYY-MM-DD — resolvé fechas relativas usando como referencia que hoy es ${dayName} ${today}: "mañana", "el lunes", "el viernes", "la semana que viene", "el mes que viene", etc.
${assigneeSection}
${propertySection}
${categorySection}
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
  if (typeof parsed.property_id === "string" && parsed.property_id.trim()) {
    result.property_id = parsed.property_id.trim();
  }

  return result;
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function callGemini(apiKey: string, transcript: string, options: VoicePromptOptions): Promise<ExtractedTask> {
  const today = new Date().toISOString().split("T")[0];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          { text: buildSystemPrompt(today, options) },
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

async function callOpenAI(apiKey: string, transcript: string, options: VoicePromptOptions): Promise<ExtractedTask> {
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
        { role: "system", content: buildSystemPrompt(today, options) },
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

async function callAnthropic(apiKey: string, transcript: string, options: VoicePromptOptions): Promise<ExtractedTask> {
  const today = new Date().toISOString().split("T")[0];
  const systemPrompt = buildSystemPrompt(today, options);

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

async function callGroq(apiKey: string, transcript: string, options: VoicePromptOptions): Promise<ExtractedTask> {
  const today = new Date().toISOString().split("T")[0];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: buildSystemPrompt(today, options) },
        { role: "user", content: `Texto dictado: "${transcript}"` },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  const data: OpenAIResponse = await res.json();

  if (!res.ok) {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Groq API error: ${msg}`);
  }

  const raw = data.choices?.[0]?.message?.content ?? "";
  return parseExtractedTask(raw);
}

async function callAI(provider: AiProvider, apiKey: string, transcript: string, options: VoicePromptOptions): Promise<ExtractedTask> {
  if (provider === "openai") return callOpenAI(apiKey, transcript, options);
  if (provider === "anthropic") return callAnthropic(apiKey, transcript, options);
  if (provider === "groq") return callGroq(apiKey, transcript, options);
  return callGemini(apiKey, transcript, options);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useExtractTaskFromVoice(
  apiKey: string | null | undefined,
  provider: AiProvider = "gemini",
  options: VoicePromptOptions = {},
) {
  const extract = async (transcript: string): Promise<ExtractedTask> => {
    if (!apiKey) {
      throw new Error("NO_API_KEY");
    }
    if (!transcript.trim()) {
      throw new Error("EMPTY_TRANSCRIPT");
    }
    return callAI(provider, apiKey, transcript, options);
  };

  return { extract, hasApiKey: !!apiKey };
}
