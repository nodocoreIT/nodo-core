"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { clinicApi } from "@/lib/clinic/client-api";
import { isPatientPaidPlan, resolvePatientPlanId } from "@/lib/clinic/patient-subscription-plans";
import { StudiesLibrary } from "@/components/patient/studies-library";
import { StudiesUpsellCard } from "@/components/patient/studies-upsell-card";

const PROFILE_CACHE_KEY = "clinic_patient_profile_cache";

function readCachedPlan(): string | null | undefined {
  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return undefined;
    const data = JSON.parse(raw) as { subscriptionPlan?: string | null };
    return data.subscriptionPlan ?? null;
  } catch {
    return undefined;
  }
}

export default function EstudiosPage() {
  const [plan, setPlan] = useState<string | null | undefined>(() => readCachedPlan());
  const [loading, setLoading] = useState(() => readCachedPlan() === undefined);

  useEffect(() => {
    let active = true;
    clinicApi
      .getPatientProfile()
      .then((profile) => {
        if (!active) return;
        setPlan(profile.subscriptionPlan ?? null);
      })
      .catch(() => {
        /* keep cached value (or default to free) if the refresh fails */
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  const planId = resolvePatientPlanId(plan);
  return isPatientPaidPlan(planId) ? <StudiesLibrary /> : <StudiesUpsellCard />;
}
