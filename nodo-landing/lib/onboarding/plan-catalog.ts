import { createAdminClient } from "@/lib/supabase/admin";
import { getPlansForUnit } from "@/lib/panel/planes";
import type { NodePlan } from "@/lib/panel/planes";

export type OnboardingPlanOption = {
  id: string;
  code: string;
  label: string;
  priceMonthly: number;
  priceAnnualMonthly: number;
  currency: string;
  features: string[];
};

export type OnboardingPlanCatalog = {
  plans: OnboardingPlanOption[];
};

function groupFeaturesByPlan(
  groups: Array<{ id: string; label: string; sort_order: number }>,
  features: Array<{ id: string; group_id: string; label: string; sort_order: number }>,
  inclusions: Array<{ feature_id: string; plan_id: string }>,
  planId: string,
): string[] {
  const included = new Set(
    inclusions.filter((row) => row.plan_id === planId).map((row) => row.feature_id),
  );

  const result: string[] = [];
  const sortedGroups = [...groups].sort((a, b) => a.sort_order - b.sort_order);

  for (const group of sortedGroups) {
    const groupFeatures = features
      .filter((feature) => feature.group_id === group.id && included.has(feature.id))
      .sort((a, b) => a.sort_order - b.sort_order);

    if (groupFeatures.length === 0) continue;

    for (const feature of groupFeatures) {
      result.push(feature.label);
    }
  }

  return result;
}

/** Static feature lists when DB inclusions are not configured yet. */
const FALLBACK_FEATURES: Record<string, Record<string, string[]>> = {
  Autos: {
    starter: [
      "Hasta 30 vehículos en stock",
      "Ficha con fotos, precio y estado",
      "Gestión básica de clientes",
      "Contratos de venta en PDF",
      "1 usuario administrador",
      "Acceso web desde cualquier dispositivo",
    ],
    pro: [
      "Stock ilimitado de vehículos",
      "Publicación en Instagram, Facebook y MercadoLibre",
      "Link público por vehículo (QR y web)",
      "Múltiples usuarios y roles",
      "Caja, movimientos y conceptos",
      "Agenda y tareas del equipo",
      "Importación masiva CSV/Excel",
    ],
    elite: [
      "Todo lo de Pro",
      "Multi-sucursal y equipos ampliados",
      "Automatizaciones n8n para redes",
      "Integraciones y API a medida",
      "Soporte prioritario dedicado",
      "NODO ID · conexión con el ecosistema",
      "Onboarding y capacitación incluidos",
    ],
  },
  Finanzas: {
    unico: [
      "Registro de gastos diarios y fijos por rubro",
      "Múltiples cuentas (ARS / USD)",
      "Tarjetas de crédito con lógica de cuotas",
      "Seguimiento de préstamos y planes de ahorro",
      "Informe mensual con gráficos y balance",
      "Acceso web desde cualquier dispositivo",
    ],
  },
};

function fallbackFeatures(unitCode: string, planCode: string): string[] {
  const byUnit = FALLBACK_FEATURES[unitCode];
  if (!byUnit) return [];
  return byUnit[planCode.toLowerCase()] ?? [];
}

function mapPlan(
  plan: NodePlan,
  dbFeatures: string[],
  unitCode: string,
): OnboardingPlanOption {
  const features = dbFeatures.length > 0 ? dbFeatures : fallbackFeatures(unitCode, plan.code);

  return {
    id: plan.id,
    code: plan.code,
    label: plan.label,
    priceMonthly: Number(plan.price_monthly) || 0,
    priceAnnualMonthly: Number(plan.price_annual_monthly) || 0,
    currency: plan.currency || "USD",
    features,
  };
}

export async function loadOnboardingPlanCatalog(unitCode: string): Promise<OnboardingPlanCatalog> {
  const admin = createAdminClient();

  const { data: planes } = await admin
    .from("planes")
    .select("id, unit_code, code, label, price_monthly, price_annual_monthly, currency, sort_order, is_active")
    .eq("unit_code", unitCode)
    .eq("is_active", true)
    .order("sort_order");

  const activePlans = getPlansForUnit((planes ?? []) as NodePlan[], unitCode);
  if (activePlans.length === 0) {
    return { plans: [] };
  }

  const { data: groups } = await admin
    .from("plan_feature_groups")
    .select("id, label, sort_order")
    .eq("unit_code", unitCode)
    .order("sort_order");

  const groupList = groups ?? [];
  const groupIds = groupList.map((group) => group.id);

  let featureRows: Array<{ id: string; group_id: string; label: string; sort_order: number }> = [];
  if (groupIds.length > 0) {
    const { data } = await admin
      .from("plan_features")
      .select("id, group_id, label, sort_order")
      .in("group_id", groupIds)
      .order("sort_order");
    featureRows = data ?? [];
  }

  const planIds = activePlans.map((plan) => plan.id);
  let inclusions: Array<{ feature_id: string; plan_id: string }> = [];
  if (planIds.length > 0 && featureRows.length > 0) {
    const { data } = await admin
      .from("plan_feature_inclusions")
      .select("feature_id, plan_id")
      .in("plan_id", planIds);
    inclusions = data ?? [];
  }

  return {
    plans: activePlans.map((plan) =>
      mapPlan(
        plan,
        groupFeaturesByPlan(groupList, featureRows, inclusions, plan.id),
        unitCode,
      ),
    ),
  };
}

export function formatOnboardingPlanPrice(plan: OnboardingPlanOption): string {
  const symbol = plan.currency === "USD" ? "USD" : plan.currency;
  const amount =
    plan.priceMonthly % 1 === 0 ? plan.priceMonthly.toFixed(0) : plan.priceMonthly.toFixed(2);
  return `${symbol} ${amount}/mes`;
}
