import { useEffect, useRef, useState } from "react";
import { Loader2, Bell, ChevronRight, X, Trash2 } from "lucide-react";
import { NotificationBellBadge, NotificationBellButton } from "@nodocore/shared-components";
import { cn } from "../lib/cn";
import type { AppNotification, NotificationsDropdownProps } from "./types";
import { useNotificationDismissals, type DismissedNotification } from "./use-notification-dismissals";

type TabId = "pending" | "closed";

function formatDismissedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

export function NotificationsDropdown({
  items,
  loading = false,
  error = null,
  kindStyles,
  onNavigate,
  headerRingClass = "ring-[#EEF3F8]",
  storageKey = "default",
}: NotificationsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("pending");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { dismissed, dismissedCount, dismiss, deleteDismissed, filterActive } =
    useNotificationDismissals(storageKey);

  const activeItems = filterActive(items);
  const count = activeItems.length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleOpenToggle() {
    setIsOpen((prev) => {
      if (prev) setTab("pending");
      return !prev;
    });
  }

  function handleDismiss(notification: AppNotification) {
    dismiss(notification);
  }

  function handleNavigate(href: string) {
    setIsOpen(false);
    setTab("pending");
    onNavigate(href);
  }

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <NotificationBellButton
        onClick={handleOpenToggle}
        aria-label={
          loading ? "Cargando notificaciones" : `${count} notificación${count === 1 ? "" : "es"}`
        }
        aria-expanded={isOpen}
        badge={
          !loading && count > 0 ? (
            <NotificationBellBadge count={count} ringClassName={headerRingClass} />
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
        <div
          className="absolute right-0 z-[100] mt-2 w-80 overflow-hidden rounded-md border border-border bg-white shadow-xl sm:w-96"
          style={{ isolation: "isolate" }}
        >
          <div className="border-b border-border bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-navy">Notificaciones</h3>
              <span className="rounded-pill bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                {loading ? "…" : `${count} pendiente${count === 1 ? "" : "s"}`}
              </span>
            </div>
            <div className="mt-2 flex gap-1">
              <button
                type="button"
                onClick={() => setTab("pending")}
                className={cn(
                  "cursor-pointer rounded-pill px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  tab === "pending"
                    ? "bg-white text-navy shadow-sm"
                    : "text-slate2 hover:text-navy",
                )}
              >
                Pendientes
              </button>
              <button
                type="button"
                onClick={() => setTab("closed")}
                className={cn(
                  "cursor-pointer rounded-pill px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  tab === "closed"
                    ? "bg-white text-navy shadow-sm"
                    : "text-slate2 hover:text-navy",
                )}
              >
                Cerradas{dismissedCount > 0 ? ` (${dismissedCount})` : ""}
              </button>
            </div>
          </div>

          <div className="max-h-[360px] overflow-y-auto divide-y divide-border bg-white">
            {loading ? (
              <div className="flex items-center justify-center gap-2 bg-white py-10 text-sm text-slate2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </div>
            ) : error ? (
              <div className="bg-white px-4 py-8 text-center text-sm text-destructive">{error}</div>
            ) : tab === "pending" ? (
              activeItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center bg-white px-4 py-8 text-center">
                  <Bell className="h-8 w-8 text-slate2/40" />
                  <p className="mt-2 text-sm text-slate2">No tenés novedades por el momento</p>
                </div>
              ) : (
                activeItems.map((notif) => (
                  <PendingNotificationRow
                    key={notif.id}
                    notif={notif}
                    kindStyles={kindStyles}
                    onNavigate={handleNavigate}
                    onDismiss={handleDismiss}
                  />
                ))
              )
            ) : dismissed.length === 0 ? (
              <div className="flex flex-col items-center justify-center bg-white px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-slate2/40" />
                <p className="mt-2 text-sm text-slate2">Sin notificaciones cerradas</p>
              </div>
            ) : (
              dismissed.map((notif) => (
                <ClosedNotificationRow
                  key={notif.id}
                  notif={notif}
                  kindStyles={kindStyles}
                  onNavigate={handleNavigate}
                  onDelete={() => deleteDismissed(notif.id)}
                />
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PendingNotificationRow({
  notif,
  kindStyles,
  onNavigate,
  onDismiss,
}: {
  notif: AppNotification;
  kindStyles: NotificationsDropdownProps["kindStyles"];
  onNavigate: (href: string) => void;
  onDismiss: (notif: AppNotification) => void;
}) {
  const style = kindStyles[notif.kind] ?? kindStyles.default;
  const Icon = style?.icon ?? Bell;

  return (
    <div className="group flex w-full items-start gap-2 bg-white p-3 pr-2 transition-colors hover:bg-slate-50">
      <button
        type="button"
        onClick={() => onNavigate(notif.href)}
        className="flex min-w-0 flex-1 cursor-pointer gap-3 text-left"
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
          <p className="mb-1 text-xs font-semibold leading-none text-navy">{notif.title}</p>
          <p className="text-[11px] leading-relaxed text-slate2">{notif.description}</p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate2" />
      </button>
      <button
        type="button"
        onClick={() => onDismiss(notif)}
        className="mt-0.5 shrink-0 cursor-pointer rounded-full p-1.5 text-slate2 transition-colors hover:bg-slate-100 hover:text-navy"
        aria-label="Cerrar notificación"
        title="Cerrar notificación"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ClosedNotificationRow({
  notif,
  kindStyles,
  onNavigate,
  onDelete,
}: {
  notif: DismissedNotification;
  kindStyles: NotificationsDropdownProps["kindStyles"];
  onNavigate: (href: string) => void;
  onDelete: () => void;
}) {
  const style = kindStyles[notif.kind] ?? kindStyles.default;
  const Icon = style?.icon ?? Bell;

  return (
    <div className="group flex w-full items-start gap-2 bg-white p-3 pr-2 transition-colors hover:bg-slate-50">
      <button
        type="button"
        onClick={() => onNavigate(notif.href)}
        className="flex min-w-0 flex-1 cursor-pointer gap-3 text-left opacity-80"
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
          <p className="mb-1 text-xs font-semibold leading-none text-navy">{notif.title}</p>
          <p className="text-[11px] leading-relaxed text-slate2">{notif.description}</p>
          {notif.dismissedAt ? (
            <p className="mt-1 text-[10px] text-slate2/70">
              Cerrada {formatDismissedDate(notif.dismissedAt)}
            </p>
          ) : null}
        </div>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="mt-0.5 shrink-0 cursor-pointer rounded-full p-1.5 text-slate2 transition-colors hover:bg-rose-50 hover:text-rose-600"
        aria-label="Eliminar notificación"
        title="Eliminar permanentemente"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
