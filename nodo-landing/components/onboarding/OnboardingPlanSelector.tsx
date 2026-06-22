"use client";

import { useEffect, useRef, useState } from "react";
import type { NodeAccent } from "@/lib/node-accents";
import {
  formatOnboardingPlanPrice,
  type OnboardingPlanOption,
} from "@/lib/onboarding/plan-catalog";

interface OnboardingPlanSelectorProps {
  plans: OnboardingPlanOption[];
  value: string;
  onChange: (code: string) => void;
  accent: NodeAccent;
}

export function OnboardingPlanSelector({
  plans,
  value,
  onChange,
  accent,
}: OnboardingPlanSelectorProps) {
  const [tooltipPlanCode, setTooltipPlanCode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tooltipPlanCode) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (containerRef.current?.contains(target ?? null)) return;
      setTooltipPlanCode(null);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [tooltipPlanCode]);

  if (plans.length === 0) {
    return (
      <p className="mt-1 text-sm" style={{ color: "rgba(234,240,247,.55)" }}>
        Consultá con el equipo de NODO Core los planes disponibles.
      </p>
    );
  }

  const tooltipPlan = plans.find((plan) => plan.code === tooltipPlanCode) ?? null;

  function handlePlanClick(code: string) {
    onChange(code);
    setTooltipPlanCode((current) => (current === code ? null : code));
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="mt-1 flex flex-wrap gap-2">
        {plans.map((plan) => {
          const selected = value === plan.code;
          const tooltipOpen = tooltipPlanCode === plan.code;

          return (
            <button
              key={plan.code}
              type="button"
              onClick={() => handlePlanClick(plan.code)}
              aria-pressed={selected}
              aria-expanded={tooltipOpen}
              className="rounded-lg px-3 py-2.5 text-left border font-medium transition-colors min-w-34"
              style={{
                borderColor: selected || tooltipOpen ? accent.brand : "rgba(255,255,255,.2)",
                background:
                  selected || tooltipOpen
                    ? `rgba(${accent.rgb},.22)`
                    : "rgba(255,255,255,.06)",
                color: selected || tooltipOpen ? "#fff" : "rgba(234,240,247,.75)",
                boxShadow: tooltipOpen ? `0 0 0 1px rgba(${accent.rgb},.35)` : undefined,
              }}
            >
              <span className="block text-sm font-semibold">{plan.label}</span>
              <span
                className="block text-xs mt-0.5 font-normal"
                style={{ color: selected || tooltipOpen ? "rgba(255,255,255,.85)" : "rgba(234,240,247,.5)" }}
              >
                {formatOnboardingPlanPrice(plan)}
              </span>
            </button>
          );
        })}
      </div>

      {tooltipPlan && tooltipPlan.features.length > 0 && (
        <div
          role="tooltip"
          className="absolute left-0 right-0 z-20 mt-2 rounded-xl border p-4 shadow-xl"
          style={{
            background: "rgba(15, 23, 36, 0.98)",
            borderColor: `rgba(${accent.rgb}, 0.35)`,
            boxShadow: `0 16px 48px rgba(0,0,0,.45), 0 0 0 1px rgba(${accent.rgb},.12)`,
          }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: accent.brand300 ?? accent.brand }}
          >
            {tooltipPlan.label} incluye
          </p>
          <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {tooltipPlan.features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-xs leading-snug"
                style={{ color: "rgba(234,240,247,.82)" }}
              >
                <span
                  aria-hidden
                  className="mt-0.5 shrink-0 font-bold"
                  style={{ color: accent.brand }}
                >
                  ✓
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px]" style={{ color: "rgba(234,240,247,.4)" }}>
            Tocá el plan de nuevo para cerrar · Anual con 2 meses de descuento
          </p>
        </div>
      )}
    </div>
  );
}
