"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clinicApi } from "@/lib/clinic/client-api";
import { getPatientPaidCheckoutPlan } from "@/lib/clinic/patient-subscription-plans";
import { toast } from "sonner";

interface PatientPlanUpsellCardProps {
  title: string;
  description: string;
}

type CachedPricing = { amount: number; currency: string } | null;
const PRICING_CACHE_KEY = "clinic_patient_pricing_cache";

function readCachedPricing(): CachedPricing | undefined {
  try {
    const raw = sessionStorage.getItem(PRICING_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedPricing) : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedPricing(pricing: CachedPricing) {
  try {
    sessionStorage.setItem(PRICING_CACHE_KEY, JSON.stringify(pricing));
  } catch {
    /* ignore */
  }
}

/** Card genérico de upsell mostrado a pacientes FREE cuando entran a una
 * sección exclusiva del plan Pago (Mis estudios, Historial, etc.) — mismo
 * diseño y flujo de checkout en todos los casos, solo cambia el título y la
 * descripción según la sección.
 *
 * El precio se cachea en sessionStorage: si ya se pidió una vez en esta
 * pestaña, se muestra de entrada sin volver a mostrar loading al navegar
 * ida y vuelta a la sección — solo se revalida en segundo plano. */
export function PatientPlanUpsellCard({ title, description }: PatientPlanUpsellCardProps) {
  const plan = getPatientPaidCheckoutPlan();
  const cached = readCachedPricing();
  const [pricing, setPricing] = useState<{ amount: number; currency: string } | null>(
    cached ?? null,
  );
  const [pricingLoading, setPricingLoading] = useState(cached === undefined);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    clinicApi
      .getPatientSubscriptionPricing()
      .then((res) => {
        const value = res.pricing ?? null;
        setPricing(value);
        writeCachedPricing(value);
      })
      .catch(() => {
        /* keep cached/fallback value if the refresh fails */
      })
      .finally(() => setPricingLoading(false));
  }, []);

  const priceLabel = pricing
    ? `${pricing.currency === "USD" ? "US$ " : "$ "}${
        pricing.currency === "USD" ? pricing.amount : pricing.amount.toLocaleString("es-AR")
      }`
    : plan.price;

  const handleCheckout = async () => {
    setCheckingOut(true);
    try {
      const result = await clinicApi.startPatientSubscriptionCheckout(plan.id);
      window.location.href = result.initPoint;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo iniciar el pago");
    } finally {
      setCheckingOut(false);
    }
  };

  if (pricingLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-6 py-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
          <Lock className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        </div>
        <p className="text-2xl font-bold text-slate-800">
          {priceLabel} <span className="text-xs font-normal text-slate-400">/mes</span>
        </p>
        <ul className="text-left space-y-1.5 max-w-xs mx-auto">
          {plan.features.map((feature) => (
            <li key={feature} className="text-xs text-slate-600 flex items-center gap-1.5">
              <span className="text-emerald-500">✓</span>
              {feature}
            </li>
          ))}
        </ul>
        <Button
          type="button"
          disabled={checkingOut}
          onClick={() => void handleCheckout()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 w-full sm:w-auto"
        >
          {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Actualizar a plan {plan.name}
        </Button>
      </div>
    </div>
  );
}
