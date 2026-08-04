"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button, cn } from "@nodocore/shared-components";
import { Loader2, Lock } from "lucide-react";
import {
  getCatalogPlansForUnit,
  getPlanByCode,
  mergeUnitPlans,
  type PlatformPlanDefinition,
} from "./platform-plan-catalog";
import {
  fetchMyBillingSubscriptionRow,
  fetchUnitPlansForSubscriber,
  formatUnitPlanPrice,
  startPlatformSubscriptionCheckout,
  type BillingCycle,
} from "./platform-billing";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface SubscriptionPlanUpgradePanelProps {
  supabase: SupabaseClient;
  unitCode: string;
  nodeLabel: string;
  backUrl: string;
  landingOrigin?: string;
  className?: string;
  impagoWarning?: string;
}

export function SubscriptionPlanUpgradePanel({
  supabase,
  unitCode,
  nodeLabel,
  backUrl,
  landingOrigin,
  className,
  impagoWarning,
}: SubscriptionPlanUpgradePanelProps) {
  const [plans, setPlans] = useState<PlatformPlanDefinition[]>(() =>
    getCatalogPlansForUnit(unitCode),
  );
  const [currentPlanCode, setCurrentPlanCode] = useState<string | null>(null);
  const [currentBillingCycle, setCurrentBillingCycle] = useState<BillingCycle | null>(null);
  const [clientUnitStatus, setClientUnitStatus] = useState<string | null>(null);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("annual");
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [remotePlans, billingRow] = await Promise.all([
        fetchUnitPlansForSubscriber(supabase, unitCode),
        fetchMyBillingSubscriptionRow(supabase, unitCode),
      ]);

      const merged = mergeUnitPlans(unitCode, remotePlans);
      setPlans(merged.length > 0 ? merged : getCatalogPlansForUnit(unitCode));

      const current = billingRow?.plan_code ?? null;
      setCurrentPlanCode(current);
      setCurrentBillingCycle(billingRow?.billing_cycle === "annual" ? "annual" : billingRow?.billing_cycle === "monthly" ? "monthly" : null);
      setClientUnitStatus(billingRow?.client_unit_status ?? null);
      setSelectedPlanCode((prev) => {
        if (prev) return prev;
        if (current) return current;
        return merged[0]?.code ?? getCatalogPlansForUnit(unitCode)[0]?.code ?? null;
      });
    } catch (e) {
      const fallback = getCatalogPlansForUnit(unitCode);
      setPlans(fallback);
      setError(e instanceof Error ? e.message : "No se pudieron cargar los planes.");
      setSelectedPlanCode((prev) => prev ?? fallback[0]?.code ?? null);
    } finally {
      setLoading(false);
    }
  }, [supabase, unitCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentPlan = useMemo(
    () => getPlanByCode(plans, currentPlanCode) ?? plans[0] ?? null,
    [plans, currentPlanCode],
  );

  const selectedPlan = useMemo(
    () => getPlanByCode(plans, selectedPlanCode),
    [plans, selectedPlanCode],
  );

  const effectiveCurrentCode = currentPlanCode ?? currentPlan?.code ?? null;

  const canCheckout = Boolean(
    selectedPlan &&
      effectiveCurrentCode &&
      (selectedPlan.code !== effectiveCurrentCode ||
        (currentBillingCycle !== null && billingCycle !== currentBillingCycle)),
  );

  const handleCheckout = async () => {
    if (!selectedPlan || !canCheckout) return;
    setCheckingOut(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Debés iniciar sesión para cambiar de plan.");

      const result = await startPlatformSubscriptionCheckout({
        landingOrigin,
        unitCode,
        planCode: selectedPlan.code,
        backUrl,
        accessToken: token,
        billingCycle,
      });

      if (result.initPoint) {
        window.location.href = result.initPoint;
        return;
      }

      if (result.planChanged) {
        setCurrentPlanCode(selectedPlan.code);
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el pago.");
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex justify-center py-10", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className={cn("rounded-lg border border-slate-200 bg-white p-6 text-center", className)}>
        <p className="text-sm text-slate-500">
          Todavía no hay planes configurados para {nodeLabel}.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 max-w-xl", className)}>
      <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 space-y-1.5">
        <p className="text-sm font-medium text-violet-950">Tu plan de {nodeLabel}</p>
        <p className="text-[11px] text-violet-900/90 leading-relaxed">
          Elegí un plan y completá el pago en Mercado Pago para activarlo en tu cuenta.
        </p>
      </div>

      {currentPlan ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-3 space-y-1">
          <p className="text-sm font-medium text-emerald-900">
            Plan actual: {currentPlan.label}
          </p>
          <p className="text-base font-bold text-emerald-800">
            {formatUnitPlanPrice(currentPlan.priceMonthly, currentPlan.currency)}{" "}
            <span className="text-xs font-normal text-emerald-700/80">/mes</span>
          </p>
          {currentPlan.features.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {currentPlan.features.map((feature) => (
                <li
                  key={feature}
                  className="text-xs text-emerald-900/90 flex items-center gap-1.5"
                >
                  <span className="text-emerald-600">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {clientUnitStatus === "impago" ? (
        <p className="text-sm text-orange-700 bg-orange-50 rounded-lg px-4 py-3 flex items-start gap-2">
          <Lock className="h-4 w-4 shrink-0 mt-0.5" />
          {impagoWarning ??
            "No pudimos procesar el último cobro. Regularizá el pago para recuperar el acceso completo."}
        </p>
      ) : null}

      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => setBillingCycle("annual")}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            billingCycle === "annual"
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          Anual
        </button>
        <button
          type="button"
          onClick={() => setBillingCycle("monthly")}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            billingCycle === "monthly"
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          Mensual
        </button>
      </div>
      {billingCycle === "annual" ? (
        <p className="text-[11px] text-slate-500 -mt-2">
          Se cobra una vez al año (equivale a 10 meses de 12).
        </p>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-3">
        {plans.map((plan) => {
          const isCurrent = plan.code === effectiveCurrentCode && billingCycle === currentBillingCycle;
          const isSelected = plan.code === selectedPlanCode;
          const displayPrice =
            billingCycle === "annual" ? plan.priceAnnualMonthly : plan.priceMonthly;
          return (
            <button
              key={plan.code}
              type="button"
              onClick={() => setSelectedPlanCode(plan.code)}
              className={cn(
                "rounded-lg border p-3 space-y-2 text-left transition-colors",
                isSelected
                  ? "border-emerald-400 bg-emerald-50/50 ring-1 ring-emerald-200"
                  : "border-slate-200 bg-white hover:border-emerald-300",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{plan.label}</p>
                {isCurrent ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Actual
                  </span>
                ) : null}
              </div>
              <p className="text-base font-bold text-slate-800">
                {formatUnitPlanPrice(displayPrice, plan.currency)}{" "}
                <span className="text-xs font-normal text-slate-400">
                  {displayPrice > 0
                    ? billingCycle === "annual"
                      ? "/año"
                      : "/mes"
                    : displayPrice === 0
                      ? "siempre"
                      : ""}
                </span>
              </p>
              {billingCycle === "annual" && displayPrice > 0 ? (
                <p className="text-[11px] text-slate-400">
                  Equivale a {formatUnitPlanPrice(round2(displayPrice / 12), plan.currency)}/mes
                </p>
              ) : null}
              {plan.features.length > 0 ? (
                <ul className="space-y-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="text-xs text-slate-500 flex items-center gap-1">
                      <span className="text-emerald-500">✓</span> {feature}
                    </li>
                  ))}
                </ul>
              ) : null}
            </button>
          );
        })}
      </div>

      {canCheckout ? (
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={checkingOut}
            onClick={() => void handleCheckout()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {selectedPlan && selectedPlan.priceMonthly <= 0
              ? "Activar este plan"
              : "Cambiar a este plan"}
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
