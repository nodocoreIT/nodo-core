/**
 * tarjeta-fechas.ts
 * Calcula fechas de cierre y vencimiento de tarjetas de crédito en Argentina.
 * Considera fines de semana y feriados bancarios.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regla para ajustar una fecha que cae en fin de semana o feriado:
 *  - 'before' → retroceder al último día hábil anterior
 *  - 'after'  → avanzar al próximo día hábil siguiente
 */
export type ReglAjuste = 'before' | 'after';

export interface ConfigFechasTarjeta {
  /** Día fijo de cierre del período (1–31). Si el mes tiene menos días, se usa el último. */
  closingDay: number;
  /** Días corridos entre la fecha de cierre y el vencimiento del pago. */
  dueOffsetDays: number;
  /** Qué hacer cuando cierre/vencimiento cae en feriado o fin de semana. Default: 'after' */
  adjustRule?: ReglAjuste;
  /** Lista extra de feriados bancarios en formato YYYY-MM-DD. Se suma a los feriados default. */
  extraHolidays?: string[];
}

export interface FechasTarjeta {
  previousClosingDate: string; // Fecha de cierre del mes anterior
  currentClosingDate: string;  // Fecha de cierre del mes actual
  nextClosingDate: string;     // Fecha de cierre del mes siguiente
  previousDueDate: string;     // Vencimiento del mes anterior
  currentDueDate: string;      // Vencimiento del mes actual
  nextDueDate: string;         // Vencimiento del mes siguiente
}

// ─────────────────────────────────────────────────────────────────────────────
// Feriados bancarios Argentina (inamovibles + trasladables actualizados)
// ─────────────────────────────────────────────────────────────────────────────

const FERIADOS_FIJOS: string[] = [
  // 2025
  '2025-01-01', // Año Nuevo
  '2025-03-03', // Carnaval
  '2025-03-04', // Carnaval
  '2025-03-24', // Día Nacional de la Memoria por la Verdad y la Justicia
  '2025-04-02', // Día del Veterano y los Caídos en la Guerra de Malvinas
  '2025-04-17', // Jueves Santo (Semana Santa)
  '2025-04-18', // Viernes Santo (Semana Santa)
  '2025-05-01', // Día del Trabajador
  '2025-05-25', // Día de la Revolución de Mayo
  '2025-06-16', // Paso a la Inmortalidad del Gral. Güemes (trasladable)
  '2025-06-20', // Día de la Bandera
  '2025-07-09', // Día de la Independencia
  '2025-08-18', // Paso a la Inmortalidad del Gral. San Martín (trasladado)
  '2025-10-12', // Día del Respeto a la Diversidad Cultural (trasladado)
  '2025-11-24', // Día de la Soberanía Nacional (trasladado)
  '2025-12-08', // Inmaculada Concepción de María
  '2025-12-25', // Navidad

  // 2026
  '2026-01-01', // Año Nuevo
  '2026-02-16', // Carnaval
  '2026-02-17', // Carnaval
  '2026-03-24', // Día Nacional de la Memoria
  '2026-04-02', // Día de Malvinas
  '2026-04-02', // Jueves Santo (Semana Santa 2026: Easter = 5 abril)
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajador
  '2026-05-25', // Día de la Revolución de Mayo
  '2026-06-15', // Paso a la Inmortalidad del Gral. Güemes (trasladado)
  '2026-06-20', // Día de la Bandera
  '2026-07-09', // Día de la Independencia
  '2026-08-17', // Paso a la Inmortalidad del Gral. San Martín
  '2026-10-12', // Día del Respeto a la Diversidad Cultural
  '2026-11-23', // Día de la Soberanía Nacional (trasladado)
  '2026-12-08', // Inmaculada Concepción de María
  '2026-12-25', // Navidad
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

/** Convierte una fecha a string YYYY-MM-DD sin efectos de zona horaria. */
function toISODateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Devuelve el último día del mes para un año y mes dados (mes 0-indexed). */
function ultimoDiaDelMes(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Construye un Set de strings YYYY-MM-DD con todos los feriados conocidos + extras. */
function buildHolidaySet(extraHolidays: string[] = []): Set<string> {
  return new Set([...FERIADOS_FIJOS, ...extraHolidays]);
}

/** Verifica si una fecha es fin de semana (sábado o domingo). */
function esFinDeSemana(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6; // 0 = domingo, 6 = sábado
}

/** Verifica si una fecha es feriado bancario. */
function esFeriado(date: Date, holidays: Set<string>): boolean {
  return holidays.has(toISODateString(date));
}

/** Verifica si una fecha no es hábil (fin de semana o feriado). */
function esNoHabil(date: Date, holidays: Set<string>): boolean {
  return esFinDeSemana(date) || esFeriado(date, holidays);
}

/**
 * Ajusta una fecha para que caiga en un día hábil.
 * @param date  Fecha a ajustar (se clona, no se modifica).
 * @param rule  'before' = retrocede, 'after' = avanza.
 * @param holidays Set de feriados bancarios.
 */
function ajustarADiaHabil(date: Date, rule: ReglAjuste, holidays: Set<string>): Date {
  const result = new Date(date);
  const step = rule === 'before' ? -1 : 1;

  while (esNoHabil(result, holidays)) {
    result.setDate(result.getDate() + step);
  }

  return result;
}

/**
 * Calcula la fecha de cierre para un año y mes concretos,
 * ajustando si cae en fin de semana o feriado.
 */
function calcularFechaCierre(
  year: number,
  month: number, // 0-indexed
  closingDay: number,
  rule: ReglAjuste,
  holidays: Set<string>,
): Date {
  // Si el día de cierre supera los días del mes, usar el último día
  const maxDia = ultimoDiaDelMes(year, month);
  const dia = Math.min(closingDay, maxDia);

  const rawDate = new Date(year, month, dia);
  return ajustarADiaHabil(rawDate, rule, holidays);
}

/**
 * Calcula la fecha de vencimiento sumando los días de offset al cierre.
 * El offset avanza en días corridos y luego ajusta si no es hábil.
 */
function calcularFechaVencimiento(
  fechaCierre: Date,
  dueOffsetDays: number,
  rule: ReglAjuste,
  holidays: Set<string>,
): Date {
  const rawDue = new Date(fechaCierre);
  rawDue.setDate(rawDue.getDate() + dueOffsetDays);
  return ajustarADiaHabil(rawDue, rule, holidays);
}

// ─────────────────────────────────────────────────────────────────────────────
// Función principal pública
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula las fechas de cierre y vencimiento de una tarjeta de crédito.
 *
 * @param config          Configuración de la tarjeta.
 * @param referenceDate   Fecha de referencia (default: hoy).
 * @returns               Objeto con las 6 fechas (anterior / actual / siguiente).
 *
 * @example
 * const fechas = calcularFechasTarjeta({ closingDay: 26, dueOffsetDays: 14 });
 * // fechas.currentClosingDate → '2026-03-26'
 * // fechas.currentDueDate     → '2026-04-09'
 */
export function calcularFechasTarjeta(
  config: ConfigFechasTarjeta,
  referenceDate: Date = new Date(),
): FechasTarjeta {
  const { closingDay, dueOffsetDays, adjustRule = 'after', extraHolidays } = config;
  const holidays = buildHolidaySet(extraHolidays);

  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0-indexed

  // Calcular cierres para mes anterior, actual y siguiente
  const meses = [
    { year: month === 0 ? year - 1 : year, month: month === 0 ? 11 : month - 1 }, // anterior
    { year, month },                                                                // actual
    { year: month === 11 ? year + 1 : year, month: month === 11 ? 0 : month + 1 }, // siguiente
  ];

  const [prevClose, currClose, nextClose] = meses.map(({ year: y, month: m }) =>
    calcularFechaCierre(y, m, closingDay, adjustRule, holidays)
  );

  const [prevDue, currDue, nextDue] = [prevClose, currClose, nextClose].map(closeDate =>
    calcularFechaVencimiento(closeDate, dueOffsetDays, adjustRule, holidays)
  );

  return {
    previousClosingDate: toISODateString(prevClose),
    currentClosingDate:  toISODateString(currClose),
    nextClosingDate:     toISODateString(nextClose),
    previousDueDate:     toISODateString(prevDue),
    currentDueDate:      toISODateString(currDue),
    nextDueDate:         toISODateString(nextDue),
  };
}

/**
 * Dado un consumo en una fecha determinada y la configuración de una tarjeta,
 * devuelve la fecha ISO (YYYY-MM-DD) del PRIMER DÍA del mes de facturación.
 *
 * REGLAS DINÁMICAS:
 * 1. Si fecha cargo > fecha cierre real → Mes siguiente del siguiente (+2 meses)
 * 2. Si fecha cargo > fecha vencimiento real → Mes siguiente del siguiente (+2 meses)
 * 3. En otro caso → Mes siguiente (+1 mes)
 *
 * @param consumoFecha   Fecha del consumo (YYYY-MM-DD o Date).
 * @param config         Configuración de la tarjeta (diaCierre, diaVencimiento).
 */
export function calcularMesFacturacion(
  consumoFecha: string | Date,
  config: { diaCierre: number; diaVencimiento?: number }
): string {
  const fechaGasto = typeof consumoFecha === 'string'
    ? new Date(consumoFecha + 'T00:00:00')
    : new Date(consumoFecha);

  const diaCierre = config.diaCierre;
  const diaVencimiento = config.diaVencimiento || (diaCierre + 10 > 31 ? 10 : diaCierre + 10);

  // Calcular offset para usar calcularFechasTarjeta
  // Si vencimiento < cierre, asumimos que vence el mes siguiente
  const offset = diaVencimiento > diaCierre
    ? diaVencimiento - diaCierre
    : (30 - diaCierre) + diaVencimiento;

  const configFechas: ConfigFechasTarjeta = {
    closingDay: diaCierre,
    dueOffsetDays: offset,
    adjustRule: 'after'
  };

  const fechasContexto = calcularFechasTarjeta(configFechas, fechaGasto);

  // Convertir a objetos Date para comparación precisa
  const tCierre = new Date(fechasContexto.currentClosingDate + 'T00:00:00');
  const tVencimiento = new Date(fechasContexto.currentDueDate + 'T00:00:00');
  const tGasto = fechaGasto;

  let mesesAdelante = 1;

  // REGLA 1: Si superó el cierre real del mes
  if (tGasto > tCierre) {
    mesesAdelante = 2;
  }
  // REGLA 2: Si superó el vencimiento real (del resumen que está cerrando o cerró)
  else if (tGasto > tVencimiento) {
    mesesAdelante = 2;
  }

  const billingDate = new Date(tGasto.getFullYear(), tGasto.getMonth() + mesesAdelante, 1);

  return toISODateString(billingDate);
}
