"use client";

import { usePathname } from "next/navigation";
import { Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/hooks/use-theme-settings";
import {
  DEFAULT_THEME_SETTINGS,
  PATIENT_THEME_SETTINGS,
  type DoctorThemeSettings,
} from "@/lib/clinic/theme-settings";

function renderCustomBrandText(
  text: string,
  settings: DoctorThemeSettings,
  onDark?: boolean,
) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const words = trimmed.split(/\s+/);
  if (words.length === 1) {
    return (
      <span style={{ color: settings.primaryColor }}>{words[0]}</span>
    );
  }

  const lastWord = words[words.length - 1];
  const prefix = words.slice(0, -1).join(" ");

  return (
    <>
      <span
        style={
          onDark
            ? { color: settings.sidebarTextColor || "#ffffff" }
            : { color: settings.secondaryColor }
        }
      >
        {prefix}
        {" "}
      </span>
      <span style={{ color: settings.primaryColor }}>{lastWord}</span>
    </>
  );
}

interface BrandMarkProps {
  onDark?: boolean;
  className?: string;
  iconClassName?: string;
}

export function BrandMark({ onDark, className, iconClassName }: BrandMarkProps) {
  const pathname = usePathname();
  const medicoSettings = useThemeStore((s) => s.settings);
  const isMedico = pathname?.startsWith("/medico");
  const active = isMedico ? medicoSettings : PATIENT_THEME_SETTINGS;
  const fallback = isMedico ? DEFAULT_THEME_SETTINGS : PATIENT_THEME_SETTINGS;
  const settings = active ?? fallback;

  if (settings.logoType === "text") {
    return (
      <span
        className={cn(
          "font-display font-bold tracking-tight py-1 block whitespace-normal break-words leading-tight text-base sm:text-lg",
          onDark ? "max-w-[180px]" : "",
          className,
        )}
      >
        {renderCustomBrandText(settings.brandText, settings, onDark)}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="flex items-center justify-center p-1.5 rounded-md"
        style={{ backgroundColor: settings.secondaryColor }}
      >
        <Stethoscope
          className={cn("h-5 w-5 flex-shrink-0", iconClassName)}
          style={{ color: settings.primaryColor }}
          strokeWidth={2}
          aria-hidden="true"
        />
      </span>
      <span className="font-display text-xl font-bold tracking-tight">
        <span
          className={onDark ? "text-white" : ""}
          style={onDark ? undefined : { color: settings.secondaryColor }}
        >
          nodo
        </span>
        <span style={{ color: settings.primaryColor }}>salud</span>
      </span>
    </span>
  );
}
