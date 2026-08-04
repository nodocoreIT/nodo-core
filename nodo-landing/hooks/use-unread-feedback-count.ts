"use client";

import { useCallback, useEffect, useState } from "react";

const POLL_MS = 60_000;

/**
 * Polls the exact unread-feedback count (D4/D6 — see design decision).
 * Deliberately decoupled from `usePanelNotifications`'s 60s poll: this feeds
 * only the Sidebar "Feedback" badge and must reflect the full
 * `shared.feedback` history, not the lossy 10-record/7-day bell feed.
 */
export function useUnreadFeedbackCount() {
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

  return { count, refresh };
}
