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

const POLL_MS = 60_000;

export function usePanelNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
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
      ]);

      const queryError =
        unitsErr ?? clientsErr ?? tasksErr ?? ideasErr ?? profilesErr ?? splitsErr;
      if (queryError) throw queryError;

      const unsettled = (splits ?? []).filter((s) => !s.settled);
      const unsettledCajaTotal = unsettled.reduce(
        (sum, s) => sum + Number(s.share_amount ?? 0),
        0,
      );

      const notifications = buildPanelNotifications({
        units: (units ?? []) as PanelClientUnit[],
        clients: (clients ?? []) as PanelClient[],
        tasks: (tasks ?? []) as PanelTask[],
        ideas: (ideas ?? []) as PanelIdea[],
        profiles: (profiles ?? []) as PanelOnboardingProfile[],
        unsettledCajaCount: unsettled.length,
        unsettledCajaTotal,
        feedbackNotifications: (feedbackRaw ?? []) as PanelFeedbackNotification[],
      });

      setItems(notifications);
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

  return {
    items,
    count: items.length,
    loading,
    error,
    refresh: load,
  };
}
