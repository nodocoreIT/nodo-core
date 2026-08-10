import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/panel/task-status";

export type TaskNotificationType = "status_changed" | "reassigned" | "mentioned";

/** Shape of one nodo_core.task_notifications row joined with its task title and actor name. */
export type TaskNotificationRow = {
  id: string;
  task_id: string;
  type: TaskNotificationType;
  old_value: string | null;
  new_value: string | null;
  recipient_id: string;
  task: { title: string } | null;
  actor: { full_name: string | null } | null;
};

/** Deep link to the specific task — opens its edit modal directly (see KanbanBoard.tsx). */
export function taskNotificationHref(row: TaskNotificationRow): string {
  return `/panel/tareas?task=${row.task_id}`;
}

function statusLabel(status: string | null): string {
  if (!status) return "—";
  return TASK_STATUS_LABELS[status as TaskStatus] ?? status;
}

/**
 * Same copy for the in-app bell (hooks/use-panel-notifications.ts) and the
 * notification email (app/api/cron/send-task-notification-emails/route.ts) —
 * kept in one place so the two channels can't drift apart.
 */
export function describeTaskNotification(
  row: TaskNotificationRow,
  profileNameById: Map<string, string>,
): { title: string; description: string } {
  const actorName = row.actor?.full_name ?? "Alguien";
  const taskTitle = row.task?.title ?? "una tarea";

  if (row.type === "status_changed") {
    return {
      title: "Cambio de estado",
      description: `${actorName} movió "${taskTitle}" a ${statusLabel(row.new_value)}`,
    };
  }

  if (row.type === "mentioned") {
    return {
      title: "Te mencionaron",
      description: `${actorName} te mencionó en un comentario de "${taskTitle}"`,
    };
  }

  const wasAssignedToMe = row.new_value === row.recipient_id;
  const wasUnassignedFromMe = row.old_value === row.recipient_id;
  const newAssigneeName = row.new_value ? profileNameById.get(row.new_value) ?? "otra persona" : null;

  const description = wasAssignedToMe
    ? `${actorName} te asignó "${taskTitle}"`
    : wasUnassignedFromMe
      ? `${actorName} te quitó la asignación de "${taskTitle}"`
      : newAssigneeName
        ? `${actorName} reasignó "${taskTitle}" a ${newAssigneeName}`
        : `${actorName} dejó "${taskTitle}" sin asignar`;

  return { title: "Tarea reasignada", description };
}

/** Unique assignee uuids referenced by old_value/new_value on "reassigned" rows. */
export function collectAssigneeIds(rows: TaskNotificationRow[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.type === "reassigned") {
      if (row.old_value) ids.add(row.old_value);
      if (row.new_value) ids.add(row.new_value);
    }
  }
  return ids;
}
