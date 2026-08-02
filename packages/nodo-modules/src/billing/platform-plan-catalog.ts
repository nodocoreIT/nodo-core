import type { UnitPlanOption } from "./platform-billing";

export interface PlatformPlanDefinition extends UnitPlanOption {
  features: string[];
}

export const PLATFORM_PLAN_CATALOG: Record<string, PlatformPlanDefinition[]> = {
  Inmo: [
    {
      code: "starter",
      label: "Starter",
      priceMonthly: 75,
      currency: "USD",
      sortOrder: 1,
      features: [
        "Propiedades, contratos y caja",
        "Cobros de alquiler y expensas",
        "Agenda y tareas del equipo",
        "Roles Admin y Agentes",
      ],
    },
    {
      code: "pro",
      label: "Pro",
      priceMonthly: 125,
      currency: "USD",
      sortOrder: 2,
      features: [
        "Todo Starter",
        "Portales propietario e inquilino",
        "Mercado Pago integrado",
        "Automatizaciones WhatsApp y redes",
        "Integraciones Gmail / Sheets",
      ],
    },
  ],
  Finanzas: [
    {
      code: "demo",
      label: "Demo (7 días)",
      priceMonthly: 0,
      currency: "USD",
      sortOrder: 0,
      features: ["Prueba gratuita de 7 días", "Gastos, tarjetas y préstamos", "Informe mensual"],
    },
    {
      code: "unico",
      label: "Plan único",
      priceMonthly: 4.99,
      currency: "USD",
      sortOrder: 1,
      features: [
        "Gastos diarios y fijos",
        "Tarjetas, préstamos y planes de ahorro",
        "Carga por voz con IA",
        "Informe mensual completo",
      ],
    },
  ],
};

export function getCatalogPlansForUnit(unitCode: string): PlatformPlanDefinition[] {
  const key = Object.keys(PLATFORM_PLAN_CATALOG).find(
    (k) => k.toLowerCase() === unitCode.trim().toLowerCase(),
  );
  if (!key) return [];
  return [...PLATFORM_PLAN_CATALOG[key]].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** RPC rows override price/label; catalog supplies features and fills gaps when RPC is empty. */
export function mergeUnitPlans(
  unitCode: string,
  remotePlans: UnitPlanOption[],
): PlatformPlanDefinition[] {
  const catalog = getCatalogPlansForUnit(unitCode);
  if (remotePlans.length === 0) return catalog;

  const catalogByCode = new Map(catalog.map((p) => [p.code, p]));
  return remotePlans
    .map((remote) => {
      const fromCatalog = catalogByCode.get(remote.code);
      return {
        ...remote,
        features: fromCatalog?.features ?? [],
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getPlanByCode(
  plans: PlatformPlanDefinition[],
  code: string | null | undefined,
): PlatformPlanDefinition | null {
  if (!code) return null;
  return plans.find((p) => p.code === code) ?? null;
}

export function planPeriodLabel(priceMonthly: number): string {
  return priceMonthly > 0 ? "/mes" : priceMonthly === 0 ? "siempre" : "";
}
