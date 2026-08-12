export type TaskStatus = "backlog" | "doing" | "review" | "deployed_qa" | "qa_testing" | "done";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Por hacer",
  doing: "En progreso",
  review: "En revisión",
  deployed_qa: "Deployado en QA",
  qa_testing: "En QA Testing",
  done: "Hecho",
};
