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
  period: "30 días",
  features: ["Hasta 20 consultas/mes", "Recetas PDF", "1 especialidad"],
};

/** Paid plans a doctor can subscribe to via Mercado Pago. */
export const PAID_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "basico",
    name: "Básico",
    amount: 9900,
    currency: "ARS",
    period: "/mes",
    features: ["Consultas ilimitadas", "Recetas + estudios", "Soporte email"],
  },
  {
    id: "profesional",
    name: "Profesional",
    amount: 19900,
    currency: "ARS",
    period: "/mes",
    features: ["Todo lo anterior", "Resumen SOAP con IA", "Multi-dispositivo"],
  },
];

export const ONBOARDING_PLANS: SubscriptionPlan[] = [TRIAL_PLAN, ...PAID_SUBSCRIPTION_PLANS];

export function findSubscriptionPlan(id: string): SubscriptionPlan | undefined {
  return PAID_SUBSCRIPTION_PLANS.find((p) => p.id === id);
}

export function formatPlanPrice(plan: SubscriptionPlan): string {
  return plan.amount === 0 ? "$0" : `$${plan.amount.toLocaleString("es-AR")}`;
}
