import { useCallback, useEffect, useState } from "react";
import type { AppNotification } from "./types";

export interface DismissedNotification {
  id: string;
  kind: string;
  title: string;
  description: string;
  href: string;
  dismissedAt: string;
}

const STORAGE_PREFIX = "nodo-dismissed-notifications:";

function readDismissed(storageKey: string): DismissedNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is DismissedNotification =>
        typeof entry?.id === "string" && typeof entry?.title === "string",
    );
  } catch {
    return [];
  }
}

/** Migrate finanzas legacy id-only dismissals into the shared format. */
function migrateLegacyFinanzasDismissals(storageKey: string): DismissedNotification[] {
  if (storageKey !== "finanzas") return [];
  try {
    const raw = localStorage.getItem("dismissed_reminders");
    if (!raw) return [];
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const migrated: DismissedNotification[] = ids
      .filter((id): id is string => typeof id === "string")
      .map((id) => ({
        id,
        kind: "legacy",
        title: "Recordatorio cerrado",
        description: "Cerrado anteriormente",
        href: "/admin/dashboard",
        dismissedAt: new Date().toISOString(),
      }));
    if (migrated.length > 0) {
      localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(migrated));
      localStorage.removeItem("dismissed_reminders");
    }
    return migrated;
  } catch {
    return [];
  }
}

export function useNotificationDismissals(storageKey: string) {
  const [dismissed, setDismissed] = useState<DismissedNotification[]>([]);

  useEffect(() => {
    let records = readDismissed(storageKey);
    if (records.length === 0) {
      records = migrateLegacyFinanzasDismissals(storageKey);
    }
    setDismissed(records);
  }, [storageKey]);

  const persist = useCallback(
    (next: DismissedNotification[]) => {
      setDismissed(next);
      try {
        localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    },
    [storageKey],
  );

  const dismiss = useCallback(
    (notification: AppNotification) => {
      const record: DismissedNotification = {
        id: notification.id,
        kind: notification.kind,
        title: notification.title,
        description: notification.description,
        href: notification.href,
        dismissedAt: new Date().toISOString(),
      };
      const next = [...dismissed.filter((d) => d.id !== notification.id), record];
      persist(next);
    },
    [dismissed, persist],
  );

  const deleteDismissed = useCallback(
    (id: string) => {
      persist(dismissed.filter((d) => d.id !== id));
    },
    [dismissed, persist],
  );

  const filterActive = useCallback(
    (items: AppNotification[]) => {
      const ids = new Set(dismissed.map((d) => d.id));
      return items.filter((i) => !ids.has(i.id));
    },
    [dismissed],
  );

  return {
    dismissed,
    dismissedCount: dismissed.length,
    dismiss,
    deleteDismissed,
    filterActive,
  };
}
