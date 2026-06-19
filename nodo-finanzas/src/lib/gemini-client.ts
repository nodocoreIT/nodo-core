/** Modelo Gemini soportado para generateContent (reemplaza gemini-1.5-flash-latest). */
export const GEMINI_MODEL = 'gemini-2.0-flash';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message: string };
}

export function extractJsonFromGeminiText(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('GEMINI_ERROR: Respuesta vacía del modelo');
  }

  const fenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(fenced) as Record<string, unknown>;
  } catch {
    const start = fenced.indexOf('{');
    const end = fenced.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(fenced.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error('GEMINI_ERROR: No se pudo leer JSON de la respuesta');
  }
}

export async function geminiGenerateText(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: systemPrompt }, { text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
      },
    }),
  });

  const data: GeminiResponse = await res.json();

  if (!res.ok) {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`GEMINI_ERROR: ${msg}`);
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export async function geminiGenerateJson(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<Record<string, unknown>> {
  const text = await geminiGenerateText(apiKey, systemPrompt, userPrompt);
  return extractJsonFromGeminiText(text);
}
