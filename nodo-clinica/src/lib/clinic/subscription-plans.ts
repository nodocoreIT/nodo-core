export interface SubscriptionPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  period: string;
  features: string[];
}

export const TRIAL_PLAN: SubscriptionPlan = {
  id: "trial",
  name: "Prueba gratis",
  amount: 0,
  currency: "ARS",
  period: "10 días",
  features: ["Acceso completo a Nodo Clínica", "Sin límite de consultas", "Válido por 10 días"],
};

/**
 * Paid plans a doctor can subscribe to via Mercado Pago. Only one today —
 * matches nodo_core.planes' single active médico paid plan (medico_pro).
 * These static values are the fallback shown before ONBOARDING_PLAN_DB_CODES'
 * live pricing loads (see onboarding/medico/page.tsx).
 */
export const PAID_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "profesional",
    name: "Pro",
    amount: 99,
    currency: "USD",
    period: "/mes",
    features: ["Consultas ilimitadas", "Recetas + estudios", "Resumen SOAP con IA", "Multi-dispositivo"],
  },
];

export const ONBOARDING_PLANS: SubscriptionPlan[] = [TRIAL_PLAN, ...PAID_SUBSCRIPTION_PLANS];

export function findSubscriptionPlan(id: string): SubscriptionPlan | undefined {
  return PAID_SUBSCRIPTION_PLANS.find((p) => p.id === id);
}

export function formatPlanPrice(plan: SubscriptionPlan): string {
  if (plan.amount === 0) return plan.currency === "USD" ? "US$0" : "$0";
  const formatted = plan.amount.toLocaleString("es-AR");
  return plan.currency === "USD" ? `US$${formatted}` : `$${formatted}`;
}
