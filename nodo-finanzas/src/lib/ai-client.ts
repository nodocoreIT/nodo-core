import type { AiProvider } from '@/hooks/use-ai-settings';
import { GEMINI_MODEL, extractJsonFromGeminiText } from './gemini-client';

// ── Response types ────────────────────────────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
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

// ── Per-provider callers ──────────────────────────────────────────────────────

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: systemPrompt }, { text: userPrompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
    }),
  });
  const data: GeminiResponse = await res.json();
  if (!res.ok) throw new Error(`AI_ERROR: ${data.error?.message ?? `HTTP ${res.status}`}`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callOpenAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });
  const data: OpenAIResponse = await res.json();
  if (!res.ok) throw new Error(`AI_ERROR: ${data.error?.message ?? `HTTP ${res.status}`}`);
  return data.choices?.[0]?.message?.content ?? '';
}

async function callAnthropic(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }],
    }),
  });
  const data: AnthropicResponse = await res.json();
  if (!res.ok) throw new Error(`AI_ERROR: ${data.error?.message ?? `HTTP ${res.status}`}`);
  return data.content?.[0]?.text ?? '';
}

async function callGroq(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });
  const data: OpenAIResponse = await res.json();
  if (!res.ok) throw new Error(`AI_ERROR: ${data.error?.message ?? `HTTP ${res.status}`}`);
  return data.choices?.[0]?.message?.content ?? '';
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function aiGenerateText(
  provider: AiProvider,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  if (provider === 'openai') return callOpenAI(apiKey, systemPrompt, userPrompt);
  if (provider === 'anthropic') return callAnthropic(apiKey, systemPrompt, userPrompt);
  if (provider === 'groq') return callGroq(apiKey, systemPrompt, userPrompt);
  return callGemini(apiKey, systemPrompt, userPrompt);
}

export async function aiGenerateJson(
  provider: AiProvider,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<Record<string, unknown>> {
  const text = await aiGenerateText(provider, apiKey, systemPrompt, userPrompt);
  return extractJsonFromGeminiText(text); // parser es agnóstico al provider
}
