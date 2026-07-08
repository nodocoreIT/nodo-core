import type { LucideIcon } from "lucide-react";

export type AiProvider = "gemini" | "openai" | "anthropic" | "groq";

export type TaskPriority = "alta" | "media" | "baja";
export type TaskStatus = "pendiente" | "en_progreso" | "completada" | "cancelada";

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string;
  due_time: string | null;
  all_day: boolean;
  assigned_to: string | null;
  property_id?: string | null;
  contact_id?: string | null;
  vehicle_id?: string | null;
  customer_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateTaskInput = Omit<
  TaskRow,
  "id" | "created_at" | "updated_at"
> & { status?: TaskStatus };

export type UpdateTaskInput = Partial<CreateTaskInput> & { id: string };

export interface AgendaCategory {
  value: string;
  label: string;
  icon: LucideIcon;
  bg: string;
}

export interface AgendaLinkField {
  /** Column on TaskRow, e.g. vehicle_id */
  field: keyof TaskRow;
  /** Form label */
  label: string;
  /** Card prefix, e.g. "Vehículo" */
  cardPrefix: string;
  options: { value: string; label: string }[];
  emptyLabel?: string;
  searchPlaceholder?: string;
}

export interface AgendaTasksHandlers {
  tasks: TaskRow[];
  isLoading: boolean;
  createTask: (input: CreateTaskInput) => Promise<TaskRow>;
  updateTask: (input: UpdateTaskInput) => Promise<TaskRow>;
  deleteTask: (id: string) => Promise<void>;
  isSaving: boolean;
}

export interface AgendaModuleConfig {
  categories: AgendaCategory[];
  assigneeOptions: { value: string; label: string }[];
  linkFields: AgendaLinkField[];
  /** Base path for deep links, e.g. /admin/agenda */
  agendaBasePath: string;
  entityLabel?: string;
  /** Display name of the currently logged-in user, used for "assign to me" */
  currentUserName?: string;
  /** Active AI provider */
  aiProvider?: AiProvider;
  /** Active provider's API key — enables voice-to-task dictation */
  aiApiKey?: string | null;
  /** Called when the user taps the "configure AI" link in the voice error panel */
  onAiSettingsClick?: () => void;
}
