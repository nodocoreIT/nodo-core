"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const POLL_MS = 60_000;

type PendingSolicitudesCountContextValue = {
  count: number;
  refresh: () => Promise<void>;
};

const PendingSolicitudesCountContext =
  createContext<PendingSolicitudesCountContextValue | null>(null);

/**
 * Polls pending solicitudes for the Sidebar badge (same pattern as Feedback).
 * `/panel/solicitudes` calls `refresh()` after enable/delete so the badge
 * updates immediately instead of waiting for the next poll.
 */
export function PendingSolicitudesCountProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/panel/solicitudes/pending-count");
      if (!res.ok) return;
      const data = (await res.json()) as { count?: number };
      if (typeof data.count === "number") setCount(data.count);
    } catch {
      // best-effort — keep last known count on failure
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const value = useMemo(() => ({ count, refresh }), [count, refresh]);

  return (
    <PendingSolicitudesCountContext.Provider value={value}>
      {children}
    </PendingSolicitudesCountContext.Provider>
  );
}

export function usePendingSolicitudesCount(): PendingSolicitudesCountContextValue {
  const context = useContext(PendingSolicitudesCountContext);
  if (!context) {
    throw new Error(
      "usePendingSolicitudesCount must be used within PendingSolicitudesCountProvider",
    );
  }
  return context;
}
