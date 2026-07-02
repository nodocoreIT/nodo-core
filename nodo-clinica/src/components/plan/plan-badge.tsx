"use client";

import { Crown, Lock } from "lucide-react";
import { useAuth } from "@nodocore/shared-components";
import { cn } from "@/lib/utils";
import { isProPlan } from "@/lib/nodo-chat/is-pro-plan";
import { isPlatformMode } from "@/lib/clinic/platform-config";

export interface PlanBadgeProps {
  /** Plan local (modo JSON) cuando no hay JWT */
  fallbackPlan?: string | null;
  variant?: "default" | "sidebar";
  className?: string;
}

function PlanBadgeInner({
  plan,
  variant,
  className,
}: {
  plan?: string | null;
  variant: "default" | "sidebar";
  className?: string;
}) {
  const isPro = isProPlan(plan);

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm",
        variant === "sidebar" && "w-full justify-center",
        isPro
          ? "border-orange-300/60 bg-gradient-to-r from-orange-500 to-orange-600 text-white"
          : variant === "sidebar"
            ? "border-white/20 bg-white/5 text-white"
            : "border-border bg-card text-slate-600",
        className,
      )}
      title={
        isPro
          ? "Plan Pro activo"
          : "Plan Starter — contactá NodoCore para pasar a Pro"
      }
    >
      {isPro ? (
        <Crown className="h-3 w-3 shrink-0" aria-hidden />
      ) : (
        <Lock className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
      )}
      <span>{isPro ? "Pro" : "Starter"}</span>
    </div>
  );
}

function PlatformPlanBadge(props: Omit<PlanBadgeProps, "fallbackPlan">) {
  const { plan } = useAuth();
  return (
    <PlanBadgeInner plan={plan} variant={props.variant ?? "default"} className={props.className} />
  );
}

export function PlanBadge({
  fallbackPlan,
  variant = "default",
  className,
}: PlanBadgeProps) {
  if (isPlatformMode()) {
    return <PlatformPlanBadge variant={variant} className={className} />;
  }
  return (
    <PlanBadgeInner
      plan={fallbackPlan}
      variant={variant}
      className={className}
    />
  );
}
