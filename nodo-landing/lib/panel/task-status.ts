export type TaskStatus = "backlog" | "doing" | "review" | "done";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Por hacer",
  doing: "En progreso",
  review: "En revisión",
  done: "Hecho",
};
