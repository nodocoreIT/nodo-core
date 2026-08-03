import type { EditablePlan } from "@/lib/panel/plan-admin";

/** Columnas canónicas de la matriz de funcionalidades (independiente del code en DB). */
export type PlanColumnKey = "demo" | "gratis" | "starter" | "pro" | "elite";

const COLUMN_ORDER: PlanColumnKey[] = ["gratis", "demo", "starter", "pro", "elite"];

function normalizeUnitCode(unitCode: string): string {
  return unitCode
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function normalizeGroupLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Mapea el code del plan en DB a la columna de la matriz. */
export function resolvePlanColumnKey(
  unitCode: string,
  planCode: string,
): PlanColumnKey | null {
  const unit = normalizeUnitCode(unitCode);
  const c = planCode.trim().toLowerCase();

  if (c === "elite") return "elite";
  if (c === "starter") return "starter";
  if (c === "pro") return "pro";

  if (unit === "finanzas") {
    if (c === "demo" || c === "gratis" || c === "gratuito") return "gratis";
    if (c === "unico" || c === "pro") return "pro";
    return null;
  }

  if (unit === "inmo") {
    if (c === "starter") return "starter";
    if (c === "pro") return "pro";
    return null;
  }

  if (unit === "autos") {
    if (c === "starter") return "starter";
    if (c === "pro") return "pro";
    if (c === "elite") return "elite";
    return null;
  }

  if (unit === "clinica") {
    if (c === "gratis" || c === "gratuito") return "gratis";
    if (c === "demo") return "demo";
    if (c === "pro") return "pro";
    if (c.includes("paciente") && (c.includes("libre") || c.includes("gratis"))) return "gratis";
    if (c.includes("salud") || c.includes("pago")) return "pro";
    if (c.includes("medico") && c.includes("demo")) return "demo";
    if (c.includes("medico") && c.includes("pro")) return "pro";
    if (c.includes("medico")) return "pro";
    return null;
  }

  if (c === "demo") return "demo";
  if (c === "gratis" || c === "gratuito") return "gratis";
  if (c.includes("pro")) return "pro";

  return null;
}

function allowedColumnsForUnit(
  unitCode: string,
  groupLabel?: string,
): PlanColumnKey[] | null {
  const unit = normalizeUnitCode(unitCode);
  const group = groupLabel ? normalizeGroupLabel(groupLabel) : "";

  if (unit === "clinica") {
    if (group.includes("paciente")) return ["gratis", "pro"];
    if (
      group.includes("profesional") ||
      group.includes("medico") ||
      group.includes("medicos")
    ) {
      return ["demo", "pro"];
    }
    return null;
  }

  if (unit === "inmo") return ["starter", "pro"];
  if (unit === "finanzas") return ["gratis", "pro"];
  if (unit === "autos") return ["starter", "pro", "elite"];

  return null;
}

/**
 * Planes activos visibles como columnas en la matriz de funcionalidades.
 * Si no hay regla para la unidad/grupo, devuelve todos los planes activos.
 */
export function getFeatureMatrixPlans(
  unitCode: string,
  groupLabel: string | undefined,
  activePlans: EditablePlan[],
): EditablePlan[] {
  const unit = normalizeUnitCode(unitCode);
  const group = groupLabel ? normalizeGroupLabel(groupLabel) : "";

  if (unit === "clinica" && group.includes("institu")) {
    return activePlans.filter(
      (plan) => resolvePlanColumnKey(unitCode, plan.code) === null,
    );
  }

  const allowed = allowedColumnsForUnit(unitCode, groupLabel);
  if (!allowed) {
    return activePlans;
  }

  const byKey = new Map<PlanColumnKey, EditablePlan>();
  for (const plan of activePlans) {
    const key = resolvePlanColumnKey(unitCode, plan.code);
    if (!key || !allowed.includes(key) || byKey.has(key)) continue;
    byKey.set(key, plan);
  }

  return COLUMN_ORDER.filter((key) => allowed.includes(key))
    .map((key) => byKey.get(key))
    .filter((plan): plan is EditablePlan => !!plan);
}

/** Columnas por defecto cuando la categoría no define audiencia (ej. Inmo sin subgrupos). */
export function getDefaultFeatureMatrixPlans(
  unitCode: string,
  activePlans: EditablePlan[],
): EditablePlan[] {
  return getFeatureMatrixPlans(unitCode, undefined, activePlans);
}
