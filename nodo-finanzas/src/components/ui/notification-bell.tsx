import { useNavigate } from "react-router-dom";
import { Bell, Calendar, CreditCard, Wallet } from "lucide-react";
import { NotificationsDropdown } from "@nodocore/nodo-modules/notifications";
import { useNotifications } from "@/hooks/use-notifications";
import type { Notification } from "@/hooks/use-notifications";

const KIND_STYLES = {
  tarjeta: {
    icon: CreditCard,
    iconColor: "text-brand bg-brand/10",
  },
  prestamo: {
    icon: Wallet,
    iconColor: "text-amber-600 bg-amber-50",
  },
  plan: {
    icon: Calendar,
    iconColor: "text-sky-600 bg-sky-50",
  },
  default: {
    icon: Bell,
    iconColor: "text-slate2 bg-slate-100",
  },
};

function toAppNotification(notification: Notification) {
  const href =
    notification.tipo === "tarjeta"
      ? "/admin/tarjetas"
      : notification.tipo === "prestamo"
        ? "/admin/prestamos"
        : "/admin/planes-ahorro";

  return {
    id: notification.id,
    kind: notification.tipo,
    title: notification.titulo,
    description: notification.mensaje,
    href,
    priority: notification.urgencia === "alta" ? 1 : notification.urgencia === "media" ? 2 : 3,
    duesToday: notification.venceHoy,
  };
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications } = useNotifications();
  // Bell only rings for items due within 2 days — the dashboard card shows the full month
  const items = notifications.filter(n => n.urgencia === 'alta').map(toAppNotification);

  return (
    <NotificationsDropdown
      items={items}
      kindStyles={KIND_STYLES}
      onNavigate={(href) => navigate(href)}
      headerRingClass="ring-white"
      storageKey="finanzas"
    />
  );
}
