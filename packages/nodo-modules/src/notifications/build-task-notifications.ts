import type { TaskRow } from "../agenda/types";
import type { AppNotification } from "./types";

export interface TaskNotificationInput {
  tasks: TaskRow[];
  agendaBasePath: string;
  categoryLabels?: Record<string, string>;
  today?: Date;
}

function todayStr(today: Date): string {
  return today.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function categoryLabel(category: string, labels?: Record<string, string>): string {
  return labels?.[category] ?? category;
}

/** Shared task-based notifications for any nodo with agenda module. */
export function buildTaskNotifications({
  tasks,
  agendaBasePath,
  categoryLabels,
  today = new Date(),
}: TaskNotificationInput): AppNotification[] {
  const todayKey = todayStr(today);
  const horizon = addDays(todayKey, 7);
  const list: AppNotification[] = [];

  for (const task of tasks) {
    if (task.status === "completada" || task.status === "cancelada") continue;

    const cat = categoryLabel(task.category, categoryLabels);
    const baseDesc = task.assigned_to
      ? `${cat} · asignada a ${task.assigned_to}`
      : cat;

    if (task.due_date < todayKey) {
      list.push({
        id: `overdue-task-${task.id}`,
        kind: "overdue_task",
        title: "Tarea vencida",
        description: `${task.title} — ${baseDesc}`,
        href: `${agendaBasePath}?task=${task.id}`,
        priority: 5,
      });
    } else if (task.due_date === todayKey) {
      list.push({
        id: `today-task-${task.id}`,
        kind: "today_task",
        title: "Tarea para hoy",
        description: `${task.title} — ${baseDesc}`,
        href: `${agendaBasePath}?task=${task.id}`,
        priority: 15,
      });
    } else if (task.due_date <= horizon) {
      list.push({
        id: `upcoming-task-${task.id}`,
        kind: "upcoming_task",
        title: "Tarea próxima",
        description: `${task.title} — vence ${task.due_date}`,
        href: `${agendaBasePath}?task=${task.id}`,
        priority: 30,
      });
    }
  }

  return list.sort((a, b) => a.priority - b.priority);
}
