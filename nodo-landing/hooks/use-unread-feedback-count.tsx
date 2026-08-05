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

type UnreadFeedbackCountContextValue = {
  count: number;
  refresh: () => Promise<void>;
};

const UnreadFeedbackCountContext =
  createContext<UnreadFeedbackCountContextValue | null>(null);

/**
 * Polls the exact unread-feedback count (D4/D6 — see design decision).
 * Deliberately decoupled from `usePanelNotifications`'s 60s poll: this feeds
 * only the Sidebar "Feedback" badge and must reflect the full
 * `shared.feedback` history, not the lossy 10-record/7-day bell feed.
 *
 * Lives in a Provider (not a bare hook) so the Sidebar's badge and the
 * `/panel/feedback` page share the SAME count instead of each polling their
 * own independent copy — the page calls `refresh()` right after marking
 * read/unread or deleting a feedback so the sidebar updates immediately
 * instead of waiting up to 60s for the next poll.
 */
export function UnreadFeedbackCountProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/panel/feedback/unread-count");
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
    <UnreadFeedbackCountContext.Provider value={value}>
      {children}
    </UnreadFeedbackCountContext.Provider>
  );
}

export function useUnreadFeedbackCount(): UnreadFeedbackCountContextValue {
  const context = useContext(UnreadFeedbackCountContext);
  if (!context) {
    throw new Error("useUnreadFeedbackCount must be used within UnreadFeedbackCountProvider");
  }
  return context;
}
