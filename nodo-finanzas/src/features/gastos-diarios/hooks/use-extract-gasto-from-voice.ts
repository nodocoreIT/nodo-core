import { useAiSettings } from '@/hooks/use-ai-settings';
import { geminiGenerateJson } from '@/lib/gemini-client';
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

async function callGemini(
  apiKey: string,
  transcript: string,
  context: ParseGastoDictadoContext,
): Promise<Partial<ParsedGastoDictado>> {
  const fechaReferencia = context.fechaReferencia ?? new Date().toISOString().slice(0, 10);
  const parsed = await geminiGenerateJson(
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

function mergeParsed(local: ParsedGastoDictado, gemini: Partial<ParsedGastoDictado>): ParsedGastoDictado {
  const camposDetectados = new Set(local.camposDetectados);
  const advertencias = [...local.advertencias];

  const monto = local.monto ?? gemini.monto;
  const descripcion = local.descripcion ?? gemini.descripcion;
  const fecha = local.fecha ?? gemini.fecha;
  const formaPago = local.formaPago ?? gemini.formaPago;
  const rubroId = local.rubroId ?? gemini.rubroId;
  const rubroCodigo = local.rubroCodigo ?? gemini.rubroCodigo;
  const cuotas = local.cuotas ?? gemini.cuotas;

  if (monto && !local.monto) camposDetectados.add('monto');
  if (descripcion && !local.descripcion) camposDetectados.add('descripcion');
  if (fecha && !local.fecha) camposDetectados.add('fecha');
  if (formaPago && !local.formaPago) camposDetectados.add('formaPago');
  if (rubroId && !local.rubroId) camposDetectados.add('rubro');
  if (cuotas && !local.cuotas) camposDetectados.add('cuotas');

  if (gemini.monto || gemini.descripcion || gemini.rubroId) {
    advertencias.push('Parte del dictado se interpretó con IA (Gemini).');
  }

  let confianza = local.confianza;
  if (monto) confianza = Math.max(confianza, 0.35);
  if (formaPago) confianza += 0.1;
  if (rubroId) confianza += 0.15;
  if (descripcion) confianza += 0.05;

  return {
    monto,
    descripcion,
    fecha,
    formaPago,
    rubroId,
    rubroCodigo,
    tarjetaId: local.tarjetaId,
    cuentaId: local.cuentaId,
    cuotas,
    confianza: Math.min(confianza, 1),
    camposDetectados: [...camposDetectados],
    advertencias,
  };
}

export function useExtractGastoFromVoice() {
  const { aiSettings } = useAiSettings();
  const apiKey = aiSettings.geminiApiKey;

  const extract = async (context: ParseGastoDictadoContext): Promise<ParsedGastoDictado> => {
    const local = parseGastoDictado(context);

    // Parser local alcanza: no llamar a Gemini (evita fallos de red/API innecesarios).
    if (parsedTieneDatosUtiles(local)) {
      return local;
    }

    if (!apiKey) {
      throw new Error('NO_API_KEY');
    }

    try {
      const gemini = await callGemini(apiKey, context.texto, context);
      const merged = mergeParsed(local, gemini);
      if (!parsedTieneDatosUtiles(merged)) throw new Error('EMPTY_PARSE');
      return merged;
    } catch (err) {
      if (parsedTieneDatosUtiles(local)) return local;
      if (err instanceof Error) {
        if (err.message === 'NO_MONTO') throw new Error('NO_MONTO');
        if (err.message.startsWith('GEMINI_ERROR')) throw err;
      }
      throw new Error('EMPTY_PARSE');
    }
  };

  return { extract, hasApiKey: Boolean(apiKey) };
}
