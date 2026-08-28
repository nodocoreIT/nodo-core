"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clinicApi } from "@/lib/clinic/client-api";
import { getPatientPaidCheckoutPlan } from "@/lib/clinic/patient-subscription-plans";
import { toast } from "sonner";

/** Upsell shown to FREE-plan patients on "Mis estudios" instead of the upload library. */
export function StudiesUpsellCard() {
  const plan = getPatientPaidCheckoutPlan();
  const [pricing, setPricing] = useState<{ amount: number; currency: string } | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    clinicApi
      .getPatientSubscriptionPricing()
      .then((res) => setPricing(res.pricing ?? null))
      .catch(() => {
        /* fall back to the static plan price below */
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

  return (
    <div className="max-w-lg mx-auto">
      <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-6 py-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
          <Lock className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-800">Desbloqueá Mis estudios</h2>
          <p className="text-sm text-slate-500 mt-1">
            Con el plan {plan.name} podés subir, organizar y descargar tus estudios médicos cuando
            quieras.
          </p>
        </div>
        <p className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2 h-8">
          {pricingLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          ) : (
            <>
              {priceLabel} <span className="text-xs font-normal text-slate-400">/mes</span>
            </>
          )}
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
