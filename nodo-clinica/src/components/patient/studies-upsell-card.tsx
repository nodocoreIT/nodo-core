"use client";

import { PatientPlanUpsellCard } from "@/components/patient/patient-plan-upsell-card";
import { getPatientPaidCheckoutPlan } from "@/lib/clinic/patient-subscription-plans";

/** Upsell shown to FREE-plan patients on "Mis estudios" instead of the upload library. */
export function StudiesUpsellCard() {
  const plan = getPatientPaidCheckoutPlan();
  return (
    <PatientPlanUpsellCard
      title="Desbloqueá Mis estudios"
      description={`Con el plan ${plan.name} podés subir, organizar y descargar tus estudios médicos cuando quieras.`}
    />
  );
}
