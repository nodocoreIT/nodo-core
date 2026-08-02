export const PATIENT_SUBSCRIPTION_PLANS = [
  {
    id: "gratuito",
    name: "Gratuito",
    price: "$0",
    period: "siempre",
    amount: 0,
    currency: "ARS",
    features: ["Historial básico", "Videoconsulta"],
    checkoutEnabled: false,
  },
  {
    id: "pago",
    name: "Pago",
    price: "$4.900",
    period: "/mes",
    amount: 4900,
    currency: "ARS",
    features: ["Historial completo", "Prioridad de atención", "Carga de estudios"],
    checkoutEnabled: true,
  },
] as const;

export type PatientSubscriptionPlanId =
  (typeof PATIENT_SUBSCRIPTION_PLANS)[number]["id"];

export function resolvePatientPlanId(
  subscriptionPlan: string | null | undefined,
): PatientSubscriptionPlanId {
  return subscriptionPlan === "pago" ? "pago" : "gratuito";
}

export function getPatientPlanById(planId: string | null | undefined) {
  const id = resolvePatientPlanId(planId);
  return (
    PATIENT_SUBSCRIPTION_PLANS.find((p) => p.id === id) ??
    PATIENT_SUBSCRIPTION_PLANS[0]
  );
}

export function isPatientPaidPlan(planId: string): planId is "pago" {
  return planId === "pago";
}

export function getPatientPaidCheckoutPlan() {
  return PATIENT_SUBSCRIPTION_PLANS.find((p) => p.id === "pago")!;
}

export function patientPlanRequiresCheckout(
  currentPlanId: string | null | undefined,
  targetPlanId: string,
): boolean {
  if (!isPatientPaidPlan(targetPlanId)) return false;
  return resolvePatientPlanId(currentPlanId) !== targetPlanId;
}
