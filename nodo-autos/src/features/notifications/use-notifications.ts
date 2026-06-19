import { useMemo } from "react";
import { AlertTriangle, Calendar } from "lucide-react";
import { buildTaskNotifications } from "@nodocore/nodo-modules/notifications";
import { autosTasksHooks } from "@/shared/lib/autos-module-hooks";
import { AUTOS_CATEGORY_LABELS } from "@/features/agenda/agenda-config";

const AGENDA_BASE = "/admin/agenda";

export function useNotifications() {
  const { data: tasks = [], isLoading, isError } = autosTasksHooks.useTasks();

  const items = useMemo(
    () =>
      buildTaskNotifications({
        tasks,
        agendaBasePath: AGENDA_BASE,
        categoryLabels: AUTOS_CATEGORY_LABELS,
      }),
    [tasks],
  );

  return {
    items,
    count: items.length,
    loading: isLoading,
    error: isError ? "No se pudieron cargar las notificaciones." : null,
  };
}

export const AUTOS_NOTIFICATION_KIND_STYLES = {
  overdue_task: {
    icon: AlertTriangle,
    iconColor: "text-rose-600 bg-rose-50",
  },
  today_task: {
    icon: Calendar,
    iconColor: "text-brand bg-brand/10",
  },
  upcoming_task: {
    icon: Calendar,
    iconColor: "text-sky-600 bg-sky-50",
  },
} as const;
