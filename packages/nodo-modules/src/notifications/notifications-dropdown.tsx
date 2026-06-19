import { useEffect, useRef, useState } from "react";
import { Loader2, Bell, ChevronRight } from "lucide-react";
import { NotificationBellButton } from "@nodocore/shared-components";
import { cn } from "../lib/cn";
import type { NotificationsDropdownProps } from "./types";

function formatBadgeCount(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}

export function NotificationsDropdown({
  items,
  count,
  loading = false,
  error = null,
  kindStyles,
  onNavigate,
  headerRingClass = "ring-[#EEF3F8]",
}: NotificationsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <NotificationBellButton
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={
          loading ? "Cargando notificaciones" : `${count} notificación${count === 1 ? "" : "es"}`
        }
        aria-expanded={isOpen}
        badge={
          !loading && count > 0 ? (
            <span
              className={cn(
                "absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white ring-2",
                headerRingClass,
              )}
            >
              {formatBadgeCount(count)}
            </span>
          ) : undefined
        }
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate2" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
      </NotificationBellButton>

      {isOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-80 animate-in fade-in-50 slide-in-from-top-1 overflow-hidden rounded-md border border-border bg-card shadow-lg duration-200 sm:w-96">
          <div className="flex items-center justify-between border-b border-border bg-slate-50 px-4 py-3">
            <h3 className="font-display text-sm font-bold text-navy">Notificaciones</h3>
            <span className="rounded-pill bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
              {loading ? "…" : `${count} pendientes`}
            </span>
          </div>

          <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center text-sm text-destructive">{error}</div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-slate2/40" />
                <p className="mt-2 text-sm text-slate2">No tenés novedades por el momento</p>
              </div>
            ) : (
              items.map((notif) => {
                const style = kindStyles[notif.kind] ?? kindStyles.default;
                const Icon = style?.icon ?? Bell;
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onNavigate(notif.href);
                    }}
                    className="flex w-full gap-3 p-4 text-left transition-colors hover:bg-slate-50/80"
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        style?.iconColor ?? "text-slate2 bg-slate-100",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-xs font-semibold leading-none text-navy">
                        {notif.title}
                      </p>
                      <p className="text-[11px] leading-relaxed text-slate2">{notif.description}</p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate2" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
