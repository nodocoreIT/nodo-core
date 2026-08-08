import type { AiProvider } from "@nodocore/nodo-modules/settings";

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

type OpenAIResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

type CohereResponse = {
  message?:
    | { content?: Array<{ type?: string; text?: string }> }
    | string;
  error?: { message?: string };
};

const SYSTEM_PROMPT = `Sos un asistente del panel de tareas de Nodo Core.
A partir de la descripción de una tarea, devolvé UN título corto en español.

Reglas:
- Máximo 8 palabras
- Claro y accionable (verbo + objeto cuando sea posible)
- Sin comillas, sin punto final, sin numeración, sin prefijos tipo IN-01-
- Solo el título, nada más`;

function cleanTitle(raw: string): string {
  return raw
    .trim()
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.。]+$/g, "")
    // Drop accidental coded prefixes the model might invent
    .replace(/^[A-Z]{2,3}-\d+-/, "")
    .trim()
    .slice(0, 120);
}

async function callGemini(apiKey: string, description: string, unitCode?: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;
  const unitHint = unitCode ? `\nUnidad de negocio: ${unitCode}` : "";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT },
            { text: `Descripción de la tarea:${unitHint}\n\n${description}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 64,
      },
    }),
  });

  const data = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Gemini HTTP ${res.status}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const title = cleanTitle(text);
  if (!title) throw new Error("La IA no devolvió un título usable.");
  return title;
}

async function callOpenAI(apiKey: string, description: string, unitCode?: string): Promise<string> {
  const unitHint = unitCode ? `\nUnidad de negocio: ${unitCode}` : "";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Descripción de la tarea:${unitHint}\n\n${description}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 64,
    }),
  });

  const data = (await res.json()) as OpenAIResponse;
  if (!res.ok) {
    throw new Error(data.error?.message ?? `OpenAI HTTP ${res.status}`);
  }

  const title = cleanTitle(data.choices?.[0]?.message?.content ?? "");
  if (!title) throw new Error("La IA no devolvió un título usable.");
  return title;
}

async function callCohere(apiKey: string, description: string, unitCode?: string): Promise<string> {
  const unitHint = unitCode ? `\nUnidad de negocio: ${unitCode}` : "";
  const res = await fetch("https://api.cohere.com/v2/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: "command-a-03-2025",
      temperature: 0.3,
      max_tokens: 64,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Descripción de la tarea:${unitHint}\n\n${description}`,
        },
      ],
    }),
  });

  const data = (await res.json()) as CohereResponse;
  if (!res.ok) {
    const errMsg =
      data.error?.message ??
      (typeof data.message === "string" ? data.message : null) ??
      `Cohere HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  const message = typeof data.message === "object" && data.message ? data.message : null;
  const text =
    message?.content?.find((part) => part.type === "text" || part.text)?.text ??
    message?.content?.[0]?.text ??
    "";
  const title = cleanTitle(text);
  if (!title) throw new Error("La IA no devolvió un título usable.");
  return title;
}

/**
 * Suggest a short task title from a free-text description using the
 * panel AI provider (Gemini / OpenAI / Cohere).
 */
export async function generateTaskTitleFromDescription(options: {
  description: string;
  unitCode?: string;
  provider: AiProvider;
  apiKey: string;
}): Promise<string> {
  const description = options.description.trim();
  if (!description) throw new Error("Escribí una descripción primero.");
  if (!options.apiKey.trim()) {
    throw new Error("Configurá la API key de IA en Configuración → Inteligencia Artificial.");
  }

  if (options.provider === "openai") {
    return callOpenAI(options.apiKey, description, options.unitCode);
  }

  if (options.provider === "cohere") {
    return callCohere(options.apiKey, description, options.unitCode);
  }

  if (options.provider === "gemini") {
    return callGemini(options.apiKey, description, options.unitCode);
  }

  throw new Error(
    "Generar título está disponible con Gemini, OpenAI o Cohere. Cambiá el proveedor en Configuración → IA.",
  );
}
