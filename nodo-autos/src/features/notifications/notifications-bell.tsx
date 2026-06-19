import { useNavigate } from "react-router-dom";
import { NotificationsDropdown } from "@nodocore/nodo-modules/notifications";
import {
  AUTOS_NOTIFICATION_KIND_STYLES,
  useNotifications,
} from "./use-notifications";

export function NotificationsBell() {
  const navigate = useNavigate();
  const { items, loading, error } = useNotifications();

  return (
    <NotificationsDropdown
      items={items}
      loading={loading}
      error={error}
      kindStyles={AUTOS_NOTIFICATION_KIND_STYLES}
      onNavigate={(href) => navigate(href)}
      storageKey="autos"
    />
  );
}
