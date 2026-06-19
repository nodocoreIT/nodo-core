import { useNavigate } from "react-router-dom";
import { NotificationsDropdown } from "@nodocore/nodo-modules/notifications";
import {
  AUTOS_NOTIFICATION_KIND_STYLES,
  useNotifications,
} from "./use-notifications";

export function NotificationsBell() {
  const navigate = useNavigate();
  const { items, count, loading, error } = useNotifications();

  return (
    <NotificationsDropdown
      items={items}
      count={count}
      loading={loading}
      error={error}
      kindStyles={AUTOS_NOTIFICATION_KIND_STYLES}
      onNavigate={(href) => navigate(href)}
    />
  );
}
