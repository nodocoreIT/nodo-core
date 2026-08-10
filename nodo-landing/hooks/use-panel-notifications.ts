"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import {
  collectAssigneeIds,
  describeTaskNotification,
  taskNotificationHref,
  type TaskNotificationRow,
} from "@/lib/panel/task-notification-copy";
import type { AppNotification } from "@nodocore/nodo-modules/notifications";
import type { DismissedNotification } from "@nodocore/nodo-modules/notifications";

const POLL_MS = 60_000;
// Longer than panel_notifications' 7-day window: these are personal
// assignment/status events, not operational alerts — they should stay
// findable in the bell until the recipient actually dismisses them, not
// fall off after a week just because the board stayed busy.
const TASK_EVENTS_WINDOW_DAYS = 30;
const TASK_EVENTS_LIMIT = 50;

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

function buildTaskEventAppNotification(
  row: TaskNotificationRow,
  profileNameById: Map<string, string>,
): AppNotification {
  const { title, description } = describeTaskNotification(row, profileNameById);
  return {
    id: `task-event-${row.id}`,
    kind: row.type,
    title,
    description,
    href: taskNotificationHref(row),
    priority: 4,
  };
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
      const taskEventsSince = new Date(
        Date.now() - TASK_EVENTS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      const [
        { data: units, error: unitsErr },
        { data: clients, error: clientsErr },
        { data: tasks, error: tasksErr },
        { data: ideas, error: ideasErr },
        { data: profiles, error: profilesErr },
        { data: splits, error: splitsErr },
        { data: feedbackRaw },
        { data: taskEventsRaw, error: taskEventsErr },
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
        supabase
          .from("task_notifications")
          .select(
            "id, task_id, type, old_value, new_value, recipient_id, created_at, task:tasks!task_notifications_task_id_fkey(title), actor:profiles!task_notifications_actor_id_fkey(full_name)",
          )
          .gte("created_at", taskEventsSince)
          .order("created_at", { ascending: false })
          .limit(TASK_EVENTS_LIMIT),
        fetchServerDismissals(),
      ]);

      const queryError =
        unitsErr ?? clientsErr ?? tasksErr ?? ideasErr ?? profilesErr ?? splitsErr ?? taskEventsErr;
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

      const taskEvents = (taskEventsRaw ?? []) as unknown as TaskNotificationRow[];

      // task_notifications.old_value/new_value store assignee uuids as text —
      // resolve them to names for the "reasignó a X" copy. Team is tiny, one
      // extra light query is cheaper than embedding two more FK joins.
      const assigneeIds = collectAssigneeIds(taskEvents);
      let profileNameById = new Map<string, string>();
      if (assigneeIds.size > 0) {
        const { data: assigneeProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(assigneeIds));
        profileNameById = new Map(
          (assigneeProfiles ?? []).map((p) => [p.id as string, (p.full_name as string) ?? "Alguien"]),
        );
      }

      const taskEventNotifications = taskEvents.map((row) =>
        buildTaskEventAppNotification(row, profileNameById),
      );

      const merged = [...taskEventNotifications, ...allNotifications].sort(
        (a, b) => a.priority - b.priority,
      );

      const dismissedIds = new Set(serverDismissals.map((d) => d.id));
      const activeNotifications = merged.filter((n) => !dismissedIds.has(n.id));

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

  // Realtime: push a toast + refresh the moment a notification lands for me,
  // instead of waiting up to POLL_MS for the next poll — this is what makes
  // it feel like Jira instead of an email digest.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (cancelled || !uid) return;

      channel = supabase
        .channel(`task-notifications-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "nodo_core",
            table: "task_notifications",
            filter: `recipient_id=eq.${uid}`,
          },
          () => {
            toast.info("Tenés una novedad en tus tareas", { duration: 4000 });
            load();
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
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
