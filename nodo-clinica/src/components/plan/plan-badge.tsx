"use client";

import { Crown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { isProPlan } from "@/lib/nodo-chat/is-pro-plan";

export interface PlanBadgeProps {
  /** Plan passed explicitly from the caller (API session or local JSON). */
  fallbackPlan?: string | null;
  variant?: "default" | "sidebar";
  className?: string;
}

export function PlanBadge({
  fallbackPlan,
  variant = "default",
  className,
}: PlanBadgeProps) {
  const isPro = isProPlan(fallbackPlan);

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
