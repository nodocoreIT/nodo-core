import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  CreditCard,
  Info,
} from "lucide-react";
import { NotificationsDropdown } from "@nodocore/nodo-modules/notifications";
import type { NotificationKindStyle } from "@nodocore/nodo-modules/notifications";
import { useNotifications } from "@/features/dashboard/hooks/use-notifications";

const KIND_STYLES: Record<string, NotificationKindStyle> = {
  overdue_payment: {
    icon: AlertTriangle,
    iconColor: "text-rose-600 bg-rose-50",
  },
  pending_collection: {
    icon: CreditCard,
    iconColor: "text-amber-600 bg-amber-50",
  },
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
  pending_settlement: {
    icon: Info,
    iconColor: "text-violet-600 bg-violet-50",
  },
  default: {
    icon: AlertTriangle,
    iconColor: "text-slate2 bg-slate-100",
  },
};

export function NotificationsBell() {
  const navigate = useNavigate();
  const { items, loading, error } = useNotifications();

  return (
    <NotificationsDropdown
      items={items}
      loading={loading}
      error={error ? "No se pudieron cargar las notificaciones." : null}
      kindStyles={KIND_STYLES}
      onNavigate={(href) => navigate(href)}
      headerRingClass="ring-[#EEF3F8]"
      storageKey="inmo"
    />
  );
}
