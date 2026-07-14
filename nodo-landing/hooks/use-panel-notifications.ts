"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  buildPanelNotifications,
  type PanelClient,
  type PanelClientUnit,
  type PanelFeedbackNotification,
  type PanelIdea,
  type PanelOnboardingProfile,
  type PanelTask,
} from "@/lib/panel/build-panel-notifications";
import type { AppNotification } from "@nodocore/nodo-modules/notifications";
import type { DismissedNotification } from "@nodocore/nodo-modules/notifications";

const POLL_MS = 60_000;

async function fetchServerDismissals(): Promise<DismissedNotification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("dismissed_panel_notifications")
    .select("notification_id, kind, title, description, href, dismissed_at, deleted")
    .eq("deleted", false);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.notification_id as string,
    kind: row.kind as string,
    title: row.title as string,
    description: row.description as string,
    href: row.href as string,
    dismissedAt: row.dismissed_at as string,
    deleted: false,
  }));
}

export function usePanelNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [dismissedFromServer, setDismissedFromServer] = useState<DismissedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { data: units, error: unitsErr },
        { data: clients, error: clientsErr },
        { data: tasks, error: tasksErr },
        { data: ideas, error: ideasErr },
        { data: profiles, error: profilesErr },
        { data: splits, error: splitsErr },
        { data: feedbackRaw },
        serverDismissals,
      ] = await Promise.all([
        supabase
          .from("client_units")
          .select("id, client_id, unit_code, plan, status, created_at"),
        supabase.from("clients").select("id, name, email"),
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, unit_code"),
        supabase.from("ideas").select("id, title, status, created_at"),
        supabase
          .from("onboarding_profiles")
          .select("client_unit_id, plan_choice, demo_days"),
        supabase.from("expense_splits").select("share_amount, settled"),
        supabase
          .from("panel_notifications")
          .select("id, kind, category, content, source_node, created_at")
          .gte("created_at", sevenDaysAgo)
          .order("created_at", { ascending: false })
          .limit(10),
        fetchServerDismissals(),
      ]);

      const queryError =
        unitsErr ?? clientsErr ?? tasksErr ?? ideasErr ?? profilesErr ?? splitsErr;
      if (queryError) throw queryError;

      const unsettled = (splits ?? []).filter((s) => !s.settled);
      const unsettledCajaTotal = unsettled.reduce(
        (sum, s) => sum + Number(s.share_amount ?? 0),
        0,
      );

      const allNotifications = buildPanelNotifications({
        units: (units ?? []) as PanelClientUnit[],
        clients: (clients ?? []) as PanelClient[],
        tasks: (tasks ?? []) as PanelTask[],
        ideas: (ideas ?? []) as PanelIdea[],
        profiles: (profiles ?? []) as PanelOnboardingProfile[],
        unsettledCajaCount: unsettled.length,
        unsettledCajaTotal,
        feedbackNotifications: (feedbackRaw ?? []) as PanelFeedbackNotification[],
      });

      const dismissedIds = new Set(serverDismissals.map((d) => d.id));
      const activeNotifications = allNotifications.filter((n) => !dismissedIds.has(n.id));

      setDismissedFromServer(serverDismissals);
      setItems(activeNotifications);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las notificaciones.",
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(interval);
  }, [load]);

  const dismissNotification = useCallback(async (notification: AppNotification) => {
    try {
      await fetch("/api/panel/notifications/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notification_id: notification.id,
          kind: notification.kind,
          title: notification.title,
          description: notification.description,
          href: notification.href,
        }),
      });
    } catch {
      // best-effort — localStorage already saved it locally
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await fetch("/api/panel/notifications/dismiss", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: id }),
      });
    } catch {
      // best-effort
    }
  }, []);

  return {
    items,
    count: items.length,
    loading,
    error,
    refresh: load,
    dismissedFromServer,
    dismissNotification,
    deleteNotification,
  };
}
