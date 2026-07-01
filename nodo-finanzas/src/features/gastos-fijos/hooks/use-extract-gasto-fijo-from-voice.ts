import { useAiSettings, getActiveApiKey } from '@/hooks/use-ai-settings';
import type { AiProvider } from '@/hooks/use-ai-settings';
import { aiGenerateJson } from '@/lib/ai-client';
import type { FormaDePago, Rubro } from '@/types';

const FORMAS_PAGO: FormaDePago[] = [
  'EFECTIVO',
  'MERCADO_PAGO',
  'TARJETA',
  'DEBITO',
  'TRANSFERENCIA BANCO',
];

export interface ExtractedGastoFijo {
  monto?: number;
  descripcion?: string;
  rubroId?: string;
  formaDePago?: FormaDePago;
  moneda?: 'ARS' | 'USD';
}

function buildSystemPrompt(rubros: Rubro[]): string {
  const lista = rubros
    .filter((r) => r.activo)
    .map((r) => `- id: "${r.id}", codigo: "${r.codigo}", nombre: "${r.nombre}"`)
    .join('\n');

  return `Sos un asistente de finanzas personales en Argentina.
El usuario dicta un gasto fijo mensual recurrente en español rioplatense.

Rubros disponibles:
${lista || '(sin rubros cargados)'}

Devolvé SOLO un objeto JSON válido (sin markdown) con:
- monto: number (solo número; "doscientos cincuenta" → 250, "15 lucas" → 15000)
- descripcion: string breve (ej. "Netflix", "Gimnasio", "Expensas")
- formaPago: uno de ${FORMAS_PAGO.join(', ')} (si no se menciona, omitir)
- rubroId: string (id exacto del rubro más cercano, si no hay match claro omitir)
- moneda: "ARS" o "USD" (por defecto ARS si no se menciona)

Reglas:
- Si no podés inferir el monto, devolvé {"error":"no_monto"}.
- rubroId debe existir en la lista o no incluirlo.
- No devolvás nada más que el JSON.`;
}

function normalizeFormaPago(raw: unknown): FormaDePago | undefined {
  if (typeof raw !== 'string') return undefined;
  const key = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (key === 'TRANSFERENCIA' || key === 'TRANSFERENCIA_BANCO') return 'TRANSFERENCIA BANCO';
  if (FORMAS_PAGO.includes(key as FormaDePago)) return key as FormaDePago;
  if (key.includes('MERCADO')) return 'MERCADO_PAGO';
  if (key.includes('TRANSFER')) return 'TRANSFERENCIA BANCO';
  if (key.includes('DEBIT')) return 'DEBITO';
  if (key.includes('TARJETA') || key.includes('CREDIT')) return 'TARJETA';
  if (key.includes('EFECT')) return 'EFECTIVO';
  return undefined;
}

async function callAI(
  provider: AiProvider,
  apiKey: string,
  transcript: string,
  rubros: Rubro[],
): Promise<ExtractedGastoFijo> {
  const parsed = await aiGenerateJson(
    provider,
    apiKey,
    buildSystemPrompt(rubros),
    `Texto dictado: "${transcript}"`,
  );

  if (parsed.error === 'no_monto') {
    throw new Error('NO_MONTO');
  }

  const rubroIds = new Set(rubros.filter((r) => r.activo).map((r) => r.id));
  const rubroId =
    typeof parsed.rubroId === 'string' && rubroIds.has(parsed.rubroId)
      ? parsed.rubroId
      : undefined;

  const monto = Number.isFinite(Number(parsed.monto)) && Number(parsed.monto) > 0
    ? Number(parsed.monto)
    : undefined;

  if (!monto) throw new Error('NO_MONTO');

  const moneda =
    typeof parsed.moneda === 'string' && parsed.moneda.toUpperCase() === 'USD' ? 'USD' : 'ARS';

  return {
    monto,
    descripcion:
      typeof parsed.descripcion === 'string' && parsed.descripcion.trim()
        ? parsed.descripcion.trim()
        : undefined,
    formaDePago: normalizeFormaPago(parsed.formaPago),
    rubroId,
    moneda,
  };
}

export function useExtractGastoFijoFromVoice() {
  const { aiSettings } = useAiSettings();
  const apiKey = getActiveApiKey(aiSettings);
  const provider = aiSettings.provider;

  const extract = async (transcript: string, rubros: Rubro[]): Promise<ExtractedGastoFijo> => {
    if (!apiKey) throw new Error('NO_API_KEY');
    if (!transcript.trim()) throw new Error('EMPTY_TRANSCRIPT');
    return callAI(provider, apiKey, transcript, rubros);
  };

  return { extract, hasApiKey: Boolean(apiKey) };
}
