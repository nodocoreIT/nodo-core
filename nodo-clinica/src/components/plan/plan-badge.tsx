"use client";

import { Crown, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlanBadgeProps {
  /** Subscription status from the doctor's session (Supabase professionals.subscription_status). */
  subscriptionStatus?: "demo" | "pending_payment" | "active" | "expired" | "courtesy" | null;
  /** Days left in the Free/Demo trial (0 when expired or unknown). */
  trialDaysRemaining?: number;
  variant?: "default" | "sidebar";
  /** Shorter label for tight headers (mobile). */
  compact?: boolean;
  className?: string;
}

export function PlanBadge({
  subscriptionStatus,
  trialDaysRemaining,
  variant = "default",
  compact = false,
  className,
}: PlanBadgeProps) {
  // No status yet (e.g. session still resolving) — don't show a fake plan.
  if (subscriptionStatus == null) return null;

  const isActive = subscriptionStatus === "active";
  const isCourtesy = subscriptionStatus === "courtesy";
  const isDemo = subscriptionStatus === "demo";
  const isPendingPayment = subscriptionStatus === "pending_payment";
  const days = trialDaysRemaining ?? 0;
  const demoExpired = isDemo && days <= 0;

  const label = isActive
    ? "Pro"
    : isCourtesy
      ? "Cortesía"
      : demoExpired || subscriptionStatus === "expired"
        ? compact
          ? "Vencida"
          : "Demo vencida"
        : isPendingPayment
          ? "Pago pendiente"
          : isDemo
            ? compact
              ? `${days}d`
              : `Demo · ${days} día${days === 1 ? "" : "s"}`
            : "Demo";

  const title = isActive
    ? "Plan Pro activo"
    : isCourtesy
      ? "Tenés acceso de cortesía a Nodo Clínica, sin cargo"
      : demoExpired || subscriptionStatus === "expired"
        ? "Tu período de prueba venció — suscribite para seguir usando Nodo Clínica"
        : isPendingPayment
          ? "Estamos esperando la confirmación de tu pago con Mercado Pago"
          : isDemo
            ? `Te quedan ${days} día${days === 1 ? "" : "s"} de prueba gratis`
            : "Plan Demo";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm",
        compact && "px-2 gap-0.5",
        variant === "sidebar" && "w-full justify-center",
        isActive
          ? "border-orange-300/60 bg-gradient-to-r from-orange-500 to-orange-600 text-white"
          : isCourtesy
            ? "border-violet-300/60 bg-gradient-to-r from-violet-500 to-violet-600 text-white"
            : demoExpired || subscriptionStatus === "expired"
              ? "border-red-300/60 bg-red-50 text-red-700"
              : variant === "sidebar"
                ? "border-white/20 bg-white/5 text-white"
                : "border-amber-300/60 bg-amber-50 text-amber-800",
        className,
      )}
      title={title}
    >
      {isActive ? (
        <Crown className="h-3 w-3 shrink-0" aria-hidden />
      ) : isCourtesy ? (
        <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
      ) : (
        <Lock className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
      )}
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );
}
