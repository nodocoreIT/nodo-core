import { getFechaHoy } from '@/utils/formatters';
import type { Cuenta, FormaDePago, Rubro, Tarjeta } from '@/types';

export interface ParseGastoDictadoContext {
  texto: string;
  rubros: Rubro[];
  tarjetas?: Tarjeta[];
  cuentas?: Cuenta[];
  fechaReferencia?: string;
}

export interface ParsedGastoDictado {
  descripcion?: string;
  monto?: number;
  fecha?: string;
  rubroId?: string;
  rubroCodigo?: string;
  formaPago?: FormaDePago;
  tarjetaId?: string;
  cuentaId?: string;
  cuotas?: number;
  confianza: number;
  camposDetectados: string[];
  advertencias: string[];
}

const FORMA_PAGO_PATTERNS: Array<{ pattern: RegExp; value: FormaDePago }> = [
  { pattern: /\b(?:mercado\s*pago|mercadopago|mp)\b/i, value: 'MERCADO_PAGO' },
  { pattern: /\b(?:transferencia(?:\s+bancaria)?|transfer)\b/i, value: 'TRANSFERENCIA BANCO' },
  { pattern: /\b(?:tarjeta(?:\s+de\s+credito)?|credito|visa|master(?:card)?|amex)\b/i, value: 'TARJETA' },
  { pattern: /\b(?:debito|debito\s+automatico|caja\s+de\s+ahorro)\b/i, value: 'DEBITO' },
  { pattern: /\b(?:efectivo|cash|en\s+mano)\b/i, value: 'EFECTIVO' },
];

const RUBRO_KEYWORDS: Array<{ keywords: RegExp; codes: string[] }> = [
  { keywords: /\b(?:medico|doctora?|consulta|farmacia|odontologo|salud|hospital|remedio|kinesiologo)\b/i, codes: ['SALUD'] },
  { keywords: /\b(?:super|supermercado|almacen|comida|almuerzo|cena|restaurante?|delivery|panaderia|carniceria|verduleria)\b/i, codes: ['ALIMENTACION'] },
  { keywords: /\b(?:nafta|combustible|uber|taxi|subte|colectivo|peaje|estacionamiento|bondi|transporte)\b/i, codes: ['TRANSPORTE'] },
  { keywords: /\b(?:netflix|spotify|cine|streaming|entretenimiento|juego|viaje)\b/i, codes: ['ENTRETENIMIENTO'] },
  { keywords: /\b(?:luz|gas|internet|celular|agua|cable|wifi|servicio|edenor|metrogas)\b/i, codes: ['SERVICIOS'] },
  { keywords: /\b(?:gym|gimnasio|deporte|actividad\s+fisica)\b/i, codes: ['ACTIVIDAD_FISICA'] },
  { keywords: /\b(?:ropa|zapatillas|vestimenta|indumentaria)\b/i, codes: ['OTROS'] },
  { keywords: /\b(?:escuela|colegio|universidad|cuota\s+escolar)\b/i, codes: ['ESCUELA'] },
];

function normalize(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normaliza símbolos de moneda y espacios raros del dictado por voz. */
export function preprocessDictadoText(texto: string): string {
  return texto
    .replace(/[\uFF04\uFFE1\u20BF₡₹₽]/g, '$')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parsedTieneDatosUtiles(parsed: ParsedGastoDictado): boolean {
  return Boolean(
    parsed.monto ||
    parsed.descripcion ||
    parsed.rubroId ||
    parsed.formaPago ||
    parsed.fecha,
  );
}

function parseArgentineNumber(raw: string): number {
  const value = raw.trim();
  if (!value) return NaN;

  if (value.includes('.') && value.includes(',')) {
    return Number.parseFloat(value.replace(/\./g, '').replace(',', '.'));
  }

  if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
    return Number.parseFloat(value.replace(/\./g, ''));
  }

  if (value.includes(',')) {
    return Number.parseFloat(value.replace(',', '.'));
  }

  return Number.parseFloat(value);
}

function parseSpanishWordsAmount(text: string): number | undefined {
  const words = text
    .replace(/\s+y\s+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return undefined;

  const units: Record<string, number> = {
    cero: 0,
    uno: 1,
    un: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
    once: 11,
    doce: 12,
    trece: 13,
    catorce: 14,
    quince: 15,
    veinte: 20,
    treinta: 30,
    cuarenta: 40,
    cincuenta: 50,
    sesenta: 60,
    setenta: 70,
    ochenta: 80,
    noventa: 90,
  };

  const hundreds: Record<string, number> = {
    cien: 100,
    ciento: 100,
    doscientos: 200,
    doscientas: 200,
    trescientos: 300,
    trescientas: 300,
    cuatrocientos: 400,
    cuatrocientas: 400,
    quinientos: 500,
    quinientas: 500,
    seiscientos: 600,
    seiscientas: 600,
    setecientos: 700,
    setecientas: 700,
    ochocientos: 800,
    ochocientas: 800,
    novecientos: 900,
    novecientas: 900,
  };

  let total = 0;
  let current = 0;

  for (const word of words) {
    if (word === 'mil') {
      current = (current || 1) * 1000;
      total += current;
      current = 0;
      continue;
    }

    if (hundreds[word] != null) {
      current += hundreds[word];
      continue;
    }

    if (units[word] != null) {
      current += units[word];
      continue;
    }

    return undefined;
  }

  total += current;
  return total > 0 ? total : undefined;
}

function extractMontoFromWords(text: string): number | undefined {
  const normalized = normalize(text);

  const beforePesos = normalized.match(
    /(?:gast[eé]|pagu[eé]|gasto\s+de|de|un\s+gasto\s+de)\s+(?:un\s+)?([a-z\s]+?)\s+pesos?\b/,
  );
  if (beforePesos?.[1]) {
    const amount = parseSpanishWordsAmount(beforePesos[1].trim());
    if (amount) return amount;
  }

  const lucasWords = normalized.match(
    /([a-z\s]+?)\s+lucas?\b/,
  );
  if (lucasWords?.[1]) {
    const base = parseSpanishWordsAmount(lucasWords[1].trim());
    if (base) return base * 1000;
  }

  return undefined;
}

function extractMonto(text: string): number | undefined {
  const normalized = normalize(text);

  const lucasMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*lucas?\b/);
  if (lucasMatch) {
    const base = parseArgentineNumber(lucasMatch[1]);
    if (!Number.isNaN(base)) return Math.round(base * 1000);
  }

  const milMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*mil\b/);
  if (milMatch) {
    const base = parseArgentineNumber(milMatch[1]);
    if (!Number.isNaN(base)) return Math.round(base * 1000);
  }

  const patterns = [
    /\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/,
    /(?:gast[eé]|pagu[eé])\s*(?:ayer|hoy|ante\s*ayer)?\s*(?:un\s+)?(?:gasto\s+(?:de\s+)?)?\$?\s*(\d+(?:[.,]\d+)?)/,
    /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:pesos?|ars)\b/,
    /(?:gasto|gaste|pague|pague|compre|por|de)\s+(?:un\s+)?(?:gasto\s+)?(?:de\s+)?(\d{1,3}(?:\.\d{3})+|\d+(?:,\d{1,2})?)/,
    /\b(\d{1,3}(?:\.\d{3})+)\b/,
    /\b(\d{2,6})\b/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    const amount = parseArgentineNumber(match[1]);
    if (!Number.isNaN(amount) && amount > 0) return amount;
  }

  return extractMontoFromWords(text);
}

function extractFecha(text: string, referencia: string): string | undefined {
  const normalized = normalize(text);
  const base = new Date(`${referencia}T12:00:00`);

  if (/\bante\s*ayer\b/.test(normalized)) {
    base.setDate(base.getDate() - 2);
    return formatIsoDate(base);
  }

  if (/\bayer\b/.test(normalized)) {
    base.setDate(base.getDate() - 1);
    return formatIsoDate(base);
  }

  if (/\bhoy\b/.test(normalized)) {
    return referencia;
  }

  return referencia;
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extractFormaPago(text: string): FormaDePago | undefined {
  const normalized = normalize(text);
  for (const entry of FORMA_PAGO_PATTERNS) {
    if (entry.pattern.test(normalized)) return entry.value;
  }
  return undefined;
}

function extractCuotas(text: string): number | undefined {
  const normalized = normalize(text);
  const digitMatch = normalized.match(/(?:en\s+)?(\d{1,2})\s*cuotas?\b/);
  if (digitMatch) {
    const cuotas = Number.parseInt(digitMatch[1], 10);
    if (cuotas >= 1 && cuotas <= 24) return cuotas;
  }

  const words: Record<string, number> = {
    una: 1,
    un: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
  };

  const wordMatch = normalized.match(/\b(una|un|dos|tres|cuatro|cinco|seis)\s*cuotas?\b/);
  if (wordMatch) return words[wordMatch[1]];

  return undefined;
}

function scoreRubro(rubro: Rubro, normalizedText: string): number {
  const codigo = normalize(rubro.codigo);
  const nombre = normalize(rubro.nombre);

  let score = 0;
  if (codigo && normalizedText.includes(codigo)) score += 4;
  if (nombre && normalizedText.includes(nombre)) score += 5;

  for (const entry of RUBRO_KEYWORDS) {
    if (!entry.keywords.test(normalizedText)) continue;
    if (
      entry.codes.some((code) => {
        const codeNorm = normalize(code);
        return (
          (codigo && codigo === codeNorm) ||
          (nombre && (nombre.includes(codeNorm) || codeNorm.includes(nombre)))
        );
      })
    ) {
      score += 3;
    }
  }

  return score;
}

function matchRubro(text: string, rubros: Rubro[]): Rubro | undefined {
  const activos = rubros.filter((rubro) => rubro.activo);
  const normalizedText = normalize(text);

  let best: { rubro: Rubro; score: number } | undefined;
  for (const rubro of activos) {
    const score = scoreRubro(rubro, normalizedText);
    if (!best || score > best.score) best = { rubro, score };
  }

  return best && best.score >= 3 ? best.rubro : undefined;
}

function matchTarjeta(text: string, tarjetas: Tarjeta[]): Tarjeta | undefined {
  const normalizedText = normalize(text);
  const activas = tarjetas.filter((tarjeta) => tarjeta.activa);

  const scored = activas
    .map((tarjeta) => {
      const nombre = normalize(tarjeta.nombre);
      const banco = normalize(tarjeta.banco);
      const tipo = normalize(tarjeta.tipo);
      let score = 0;
      if (nombre && normalizedText.includes(nombre)) score += 4;
      if (banco && normalizedText.includes(banco)) score += 3;
      if (tipo === 'visa' && /\bvisa\b/.test(normalizedText)) score += 3;
      if (tipo === 'mastercard' && /\bmaster(?:card)?\b/.test(normalizedText)) score += 3;
      if (tipo === 'american_express' && /\bamex\b/.test(normalizedText)) score += 3;
      return { tarjeta, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.tarjeta;
}

function matchCuenta(text: string, cuentas: Cuenta[]): Cuenta | undefined {
  const normalizedText = normalize(text);
  const activas = cuentas.filter((cuenta) => cuenta.activa);

  const scored = activas
    .map((cuenta) => {
      const nombre = normalize(cuenta.nombre);
      if (!nombre) return { cuenta, score: 0 };
      return {
        cuenta,
        score: normalizedText.includes(nombre) ? 4 : 0,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.cuenta;
}

function stripKnownFragments(text: string): string {
  let working = text;

  const removablePatterns = [
    /\b(?:hoy|ayer|ante\s*ayer)\b/gi,
    /\b(?:tuve\s+un\s+gasto|gast[ée]|pagu[ée]|compr[ée])\b/gi,
    /\b(?:pagando\s+con|pague\s+con|con|por)\b/gi,
    /\$\s*\d[\d.,]*/gi,
    /\d[\d.,]*\s*(?:pesos?|ars|lucas?|mil)\b/gi,
    /\b(?:mercado\s*pago|mercadopago|transferencia(?:\s+bancaria)?|tarjeta(?:\s+de\s+credito)?|debito|efectivo|visa|master(?:card)?|amex)\b/gi,
    /\b(?:en\s+)?\d{1,2}\s*cuotas?\b/gi,
    /\b(?:un|el|la|los|las|de|en)\b/gi,
  ];

  for (const pattern of removablePatterns) {
    working = working.replace(pattern, ' ');
  }

  return working.replace(/\s+/g, ' ').trim();
}

function extractDescripcion(text: string): string | undefined {
  const normalized = normalize(text);

  const superMatch = normalized.match(/\b(?:en\s+(?:el\s+)?)?(super(?:mercado)?|almacen|farmacia|restaurante?)\b/);
  if (superMatch?.[1]) {
    return capitalizePhrase(superMatch[1] === 'super' ? 'Supermercado' : superMatch[1]);
  }

  const enMatch = normalized.match(
    /(?:en\s+(?:el|la|los|las)\s+)?([a-z][a-z\s]{1,30}?)(?:\s+pagando|\s+con\s+|\s+por\s+\d|\s*$)/,
  );
  if (enMatch?.[1]) {
    return capitalizePhrase(enMatch[1].trim());
  }

  const cleaned = stripKnownFragments(text);
  if (cleaned.length >= 3) {
    return capitalizePhrase(cleaned);
  }

  return undefined;
}

function capitalizePhrase(text: string): string {
  return text.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

export function parseGastoDictado(context: ParseGastoDictadoContext): ParsedGastoDictado {
  const texto = preprocessDictadoText(context.texto.trim());
  const fechaReferencia = context.fechaReferencia ?? getFechaHoy();
  const camposDetectados: string[] = [];
  const advertencias: string[] = [];

  if (!texto) {
    return {
      confianza: 0,
      camposDetectados,
      advertencias: ['No se detectó texto para interpretar.'],
    };
  }

  const monto = extractMonto(texto);
  if (monto) camposDetectados.push('monto');

  const fecha = extractFecha(texto, fechaReferencia);
  if (fecha) camposDetectados.push('fecha');

  const formaPago = extractFormaPago(texto);
  if (formaPago) camposDetectados.push('formaPago');

  const cuotas = extractCuotas(texto);
  if (cuotas) camposDetectados.push('cuotas');

  const rubro = matchRubro(texto, context.rubros);
  if (rubro) {
    camposDetectados.push('rubro');
  } else {
    advertencias.push('No pudimos identificar el rubro. Seleccioná uno manualmente.');
  }

  const descripcion = extractDescripcion(texto);
  if (descripcion) camposDetectados.push('descripcion');

  let tarjetaId: string | undefined;
  if (formaPago === 'TARJETA' && context.tarjetas?.length) {
    const tarjeta = matchTarjeta(texto, context.tarjetas);
    if (tarjeta) {
      tarjetaId = tarjeta.id;
      camposDetectados.push('tarjeta');
    } else if (context.tarjetas.filter((item) => item.activa).length > 1) {
      advertencias.push('Mencionaste tarjeta, pero no identificamos cuál. Elegila manualmente.');
    }
  }

  let cuentaId: string | undefined;
  if (context.cuentas?.length && formaPago && formaPago !== 'TARJETA') {
    const cuenta = matchCuenta(texto, context.cuentas);
    if (cuenta) {
      cuentaId = cuenta.id;
      camposDetectados.push('cuenta');
    }
  }

  if (!monto) {
    advertencias.unshift('No detectamos el monto. Completalo manualmente.');
  }

  let confianza = 0;
  if (monto) confianza += 0.35;
  if (formaPago) confianza += 0.2;
  if (rubro) confianza += 0.25;
  if (descripcion) confianza += 0.1;
  if (fecha) confianza += 0.1;

  return {
    descripcion,
    monto,
    fecha,
    rubroId: rubro?.id,
    rubroCodigo: rubro?.codigo,
    formaPago,
    tarjetaId,
    cuentaId,
    cuotas,
    confianza: Math.min(confianza, 1),
    camposDetectados,
    advertencias,
  };
}
