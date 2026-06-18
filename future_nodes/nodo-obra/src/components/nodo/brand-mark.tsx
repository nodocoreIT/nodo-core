"use client";

import { HardHat } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeSettings, DEFAULT_SETTINGS } from "@/hooks/use-theme-settings";

interface BrandMarkProps {
  onDark?: boolean;
  className?: string;
  iconClassName?: string;
}

export function BrandMark({ onDark, className, iconClassName }: BrandMarkProps) {
  const { settings } = useThemeSettings();
  const active = settings ?? DEFAULT_SETTINGS;

  if (active.logoType === "text") {
    return (
      <span
        className={cn(
          "font-display font-bold tracking-tight py-1 block whitespace-normal break-words leading-tight text-base sm:text-lg",
          onDark ? "max-w-[180px] text-white" : "text-navy",
          className,
        )}
      >
        {active.brandText}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="flex items-center justify-center p-1.5 rounded-md"
        style={{ backgroundColor: active.secondaryColor }}
      >
        <HardHat
          className={cn("h-5 w-5 flex-shrink-0", iconClassName)}
          style={{ color: active.primaryColor }}
          strokeWidth={2}
          aria-hidden="true"
        />
      </span>
      <span className="font-display text-xl font-bold tracking-tight">
        <span className={onDark ? "text-white" : "text-navy"}>nodo</span>
        <span className="text-brand">obra</span>
      </span>
    </span>
  );
}
