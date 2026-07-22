import type { ComponentType, ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "../lib/utils";

export type SettingsSectionNavItem<T extends string = string> = {
  id: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  mobileLabel?: string;
  locked?: boolean;
  trailing?: ReactNode;
};

type SettingsSectionNavProps<T extends string> = {
  items: SettingsSectionNavItem<T>[];
  activeId: T;
  onSelect: (id: T) => void;
  ariaLabel?: string;
  className?: string;
};

type SettingsMobileNavProps<T extends string> = SettingsSectionNavProps<T> & {
  columns?: 3 | 4;
  /** Tailwind class that hides this nav from a breakpoint up. Default: sm:hidden */
  hideFromClassName?: string;
};

export function SettingsDesktopNav<T extends string>({
  items,
  activeId,
  onSelect,
  ariaLabel = "Secciones de configuración",
  className,
}: SettingsSectionNavProps<T>) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "hidden sm:flex sm:w-52 md:w-56 shrink-0 flex-col border-r border-border bg-slate-50 overflow-y-auto",
        className,
      )}
    >
      {items.map(({ id, label, icon: Icon, locked, trailing }) => {
        const isActive = activeId === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={cn(
              "w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors border-l-2 flex items-center gap-2.5 justify-between",
              isActive
                ? "border-brand bg-brand/5 text-brand"
                : "border-transparent text-slate2 hover:bg-white hover:text-navy",
            )}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
              <span className="truncate">{label}</span>
            </span>
            {locked ? (
              <Lock className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
            ) : (
              trailing
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function SettingsMobileNav<T extends string>({
  items,
  activeId,
  onSelect,
  ariaLabel = "Secciones de configuración",
  className,
  columns = 4,
  hideFromClassName = "sm:hidden",
}: SettingsMobileNavProps<T>) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        hideFromClassName,
        "grid gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1",
        columns === 3 ? "grid-cols-3" : "grid-cols-4",
        className,
      )}
    >
      {items.map(({ id, label, icon: Icon, mobileLabel, locked }) => {
        const isActive = activeId === id;
        const displayLabel = mobileLabel ?? label;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            disabled={locked}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-md px-1 py-2.5 text-[10px] font-semibold leading-tight transition-colors",
              isActive
                ? "bg-white text-brand shadow-sm ring-1 ring-brand/25"
                : "text-slate-500 hover:bg-white/70 hover:text-slate-700",
              locked && "opacity-50",
            )}
          >
            {Icon ? (
              <Icon className="h-4 w-4 shrink-0" />
            ) : (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[9px] font-bold uppercase">
                {displayLabel.slice(0, 2)}
              </span>
            )}
            <span className="text-center">{displayLabel}</span>
          </button>
        );
      })}
    </nav>
  );
}
