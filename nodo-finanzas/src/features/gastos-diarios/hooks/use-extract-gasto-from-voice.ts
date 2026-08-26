import { useAiSettings, getActiveApiKey } from '@/hooks/use-ai-settings';
import type { AiProvider } from '@/hooks/use-ai-settings';
import { aiGenerateJson } from '@/lib/ai-client';
import {
  parseGastoDictado,
  parsedTieneDatosUtiles,
  type ParseGastoDictadoContext,
  type ParsedGastoDictado,
} from '@/features/gastos-diarios/lib/parse-gasto-dictado';
import type { FormaDePago, Rubro } from '@/types';

const FORMAS_PAGO: FormaDePago[] = [
  'EFECTIVO',
  'MERCADO_PAGO',
  'TARJETA',
  'DEBITO',
  'TRANSFERENCIA BANCO',
];

function buildSystemPrompt(rubros: Rubro[], fechaReferencia: string): string {
  const lista = rubros
    .filter((r) => r.activo)
    .map((r) => `- id: "${r.id}", codigo: "${r.codigo}", nombre: "${r.nombre}"`)
    .join('\n');

  return `Sos un asistente de finanzas personales en Argentina.
El usuario dicta un gasto diario en español rioplatense.

Rubros disponibles:
${lista || '(sin rubros cargados)'}

Fecha de referencia (hoy): ${fechaReferencia}

Devolvé SOLO un objeto JSON válido (sin markdown) con:
- monto: number (solo número; "doscientos cincuenta" → 250, "15 lucas" → 15000)
- descripcion: string breve (ej. "Médico", "Supermercado")
- fecha: string YYYY-MM-DD (si dice hoy/ayer, calculá desde la fecha de referencia)
- formaPago: uno de ${FORMAS_PAGO.join(', ')}
- rubroId: string (id exacto del rubro más cercano)
- cuotas: number opcional (si menciona cuotas en tarjeta)

Reglas:
- Si no podés inferir el monto, devolvé {"error":"no_monto"}.
- rubroId debe existir en la lista o omitirlo.
- No devolvé nada más que el JSON.`;
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
  context: ParseGastoDictadoContext,
): Promise<Partial<ParsedGastoDictado>> {
  const fechaReferencia = context.fechaReferencia ?? new Date().toISOString().slice(0, 10);
  const parsed = await aiGenerateJson(
    provider,
    apiKey,
    buildSystemPrompt(context.rubros, fechaReferencia),
    `Texto dictado: "${transcript}"`,
  );

  if (parsed.error === 'no_monto') {
    throw new Error('NO_MONTO');
  }

  const rubroIds = new Set(context.rubros.filter((r) => r.activo).map((r) => r.id));
  const rubroId =
    typeof parsed.rubroId === 'string' && rubroIds.has(parsed.rubroId)
      ? parsed.rubroId
      : undefined;

  const rubro = rubroId ? context.rubros.find((r) => r.id === rubroId) : undefined;

  return {
    monto: Number.isFinite(Number(parsed.monto)) ? Number(parsed.monto) : undefined,
    descripcion:
      typeof parsed.descripcion === 'string' && parsed.descripcion.trim()
        ? parsed.descripcion.trim()
        : undefined,
    fecha:
      typeof parsed.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.fecha)
        ? parsed.fecha
        : undefined,
    formaPago: normalizeFormaPago(parsed.formaPago),
    rubroId,
    rubroCodigo: rubro?.codigo,
    cuotas: Number.isFinite(Number(parsed.cuotas)) ? Number(parsed.cuotas) : undefined,
  };
}

/**
 * La IA es la fuente primaria (entiende "cien mil" / "100 000" / cualquier
 * variante del dictado mucho mejor que los regex del parser local); el
 * parser local solo completa lo que la IA no pudo resolver (tarjeta/cuenta,
 * que la IA ni siquiera calcula) y recalcula advertencias sobre el
 * resultado final, no sobre lo que el parser local detectó por su cuenta.
 */
function mergeParsed(
  gemini: Partial<ParsedGastoDictado>,
  local: ParsedGastoDictado,
  context: ParseGastoDictadoContext,
): ParsedGastoDictado {
  const monto = gemini.monto ?? local.monto;
  const descripcion = gemini.descripcion ?? local.descripcion;
  const fecha = gemini.fecha ?? local.fecha;
  const formaPago = gemini.formaPago ?? local.formaPago;
  const rubroId = gemini.rubroId ?? local.rubroId;
  const rubroCodigo = gemini.rubroCodigo ?? local.rubroCodigo;
  const cuotas = gemini.cuotas ?? local.cuotas;
  const tarjetaId = local.tarjetaId;
  const cuentaId = local.cuentaId;

  const camposDetectados: string[] = [];
  if (monto) camposDetectados.push('monto');
  if (descripcion) camposDetectados.push('descripcion');
  if (fecha) camposDetectados.push('fecha');
  if (formaPago) camposDetectados.push('formaPago');
  if (rubroId) camposDetectados.push('rubro');
  if (cuotas) camposDetectados.push('cuotas');
  if (tarjetaId) camposDetectados.push('tarjeta');
  if (cuentaId) camposDetectados.push('cuenta');

  const advertencias: string[] = [];
  if (!monto) advertencias.unshift('No detectamos el monto. Completalo manualmente.');
  if (!rubroId) advertencias.push('No pudimos identificar el rubro. Seleccioná uno manualmente.');
  const tarjetasActivas = context.tarjetas?.filter((t) => t.activa).length ?? 0;
  if (formaPago === 'TARJETA' && !tarjetaId && tarjetasActivas > 1) {
    advertencias.push('Mencionaste tarjeta, pero no identificamos cuál. Elegila manualmente.');
  }
  if (gemini.monto || gemini.descripcion || gemini.rubroId) {
    advertencias.push('Parte del dictado se interpretó con IA (Gemini).');
  }

  let confianza = 0;
  if (monto) confianza += 0.35;
  if (formaPago) confianza += 0.2;
  if (rubroId) confianza += 0.25;
  if (descripcion) confianza += 0.1;
  if (fecha) confianza += 0.1;

  return {
    monto,
    descripcion,
    fecha,
    formaPago,
    rubroId,
    rubroCodigo,
    tarjetaId,
    cuentaId,
    cuotas,
    confianza: Math.min(confianza, 1),
    camposDetectados,
    advertencias,
  };
}

export function useExtractGastoFromVoice() {
  const { aiSettings } = useAiSettings();
  const apiKey = getActiveApiKey(aiSettings);
  const provider = aiSettings.provider;

  const extract = async (context: ParseGastoDictadoContext): Promise<ParsedGastoDictado> => {
    const local = parseGastoDictado(context);

    // Sin API key configurada el parser local (regex) es la única opción.
    if (!apiKey) {
      if (parsedTieneDatosUtiles(local)) return local;
      throw new Error('NO_API_KEY');
    }

    try {
      const gemini = await callAI(provider, apiKey, context.texto, context);
      const merged = mergeParsed(gemini, local, context);
      if (!parsedTieneDatosUtiles(merged)) throw new Error('EMPTY_PARSE');
      return merged;
    } catch (err) {
      if (parsedTieneDatosUtiles(local)) return local;
      if (err instanceof Error) {
        if (err.message === 'NO_MONTO') throw new Error('NO_MONTO');
        if (err.message.startsWith('AI_ERROR')) throw err;
      }
      throw new Error('EMPTY_PARSE');
    }
  };

  return { extract, hasApiKey: Boolean(apiKey) };
}
