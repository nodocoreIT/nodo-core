/**
 * Mirror of @nodocore/shared-components SettingsDesktopNav / SettingsMobileNav
 * so ecommerce keeps the same configuration UX without a workspace dependency.
 */
import type { ComponentType, ReactNode } from "react";

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
  hideFromClassName?: string;
};

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

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
        "hidden sm:flex sm:w-52 md:w-56 shrink-0 flex-col border-r border-luxury-gray bg-[#111] overflow-y-auto",
        className,
      )}
    >
      {items.map(({ id, label, icon: Icon }) => {
        const isActive = activeId === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={cn(
              "w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors border-l-2 flex items-center gap-2.5",
              isActive
                ? "border-gold bg-gold/10 text-gold"
                : "border-transparent text-[#555555] hover:bg-[#1a1a1a] hover:text-luxury-gray-light",
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
            <span className="truncate">{label}</span>
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
        "grid gap-1 rounded-lg border border-luxury-gray bg-[#111] p-1",
        columns === 3 ? "grid-cols-3" : "grid-cols-4",
        className,
      )}
    >
      {items.map(({ id, label, icon: Icon, mobileLabel }) => {
        const isActive = activeId === id;
        const displayLabel = mobileLabel ?? label;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-md px-1 py-2.5 text-[10px] font-semibold leading-tight transition-colors",
              isActive
                ? "bg-[#1a1a1a] text-gold shadow-sm ring-1 ring-gold/25"
                : "text-[#555555] hover:bg-[#1a1a1a]/70 hover:text-luxury-gray-light",
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
