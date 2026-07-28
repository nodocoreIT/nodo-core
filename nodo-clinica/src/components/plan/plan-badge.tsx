"use client";

import { Crown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlanBadgeProps {
  /** Subscription status from the doctor's session (Supabase professionals.subscription_status). */
  subscriptionStatus?: "trial" | "active" | "expired" | null;
  /** Days left in the Free/Demo trial (0 when expired or unknown). */
  trialDaysRemaining?: number;
  variant?: "default" | "sidebar";
  className?: string;
}

export function PlanBadge({
  subscriptionStatus,
  trialDaysRemaining,
  variant = "default",
  className,
}: PlanBadgeProps) {
  const isActive = subscriptionStatus === "active";
  const isTrial = subscriptionStatus === "trial";
  const days = trialDaysRemaining ?? 0;
  const trialExpired = isTrial && days <= 0;

  const label = isActive
    ? "Pro"
    : trialExpired || subscriptionStatus === "expired"
      ? "Prueba vencida"
      : isTrial
        ? `Prueba · ${days} día${days === 1 ? "" : "s"}`
        : "Starter";

  const title = isActive
    ? "Plan Pro activo"
    : trialExpired || subscriptionStatus === "expired"
      ? "Tu período de prueba venció — suscribite para seguir usando Nodo Clínica"
      : isTrial
        ? `Te quedan ${days} día${days === 1 ? "" : "s"} de prueba gratis`
        : "Plan Starter";

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm",
        variant === "sidebar" && "w-full justify-center",
        isActive
          ? "border-orange-300/60 bg-gradient-to-r from-orange-500 to-orange-600 text-white"
          : trialExpired || subscriptionStatus === "expired"
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
      ) : (
        <Lock className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
      )}
      <span>{label}</span>
    </div>
  );
}
