import type { LucideIcon } from "lucide-react";
import type { DismissedNotification } from "./use-notification-dismissals";

export type NotificationKind = string;

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  href: string;
  priority: number;
  duesToday?: boolean;
}

export interface NotificationKindStyle {
  icon: LucideIcon;
  iconColor: string;
}

export interface NotificationsDropdownProps {
  items: AppNotification[];
  loading?: boolean;
  error?: string | null;
  kindStyles: Record<string, NotificationKindStyle>;
  onNavigate: (href: string) => void;
  headerRingClass?: string;
  /** localStorage scope for dismissed notifications (per nodo). */
  storageKey?: string;
  /** Server-loaded dismissed notifications to seed initial state. */
  initialDismissed?: DismissedNotification[];
  /** Called after a notification is dismissed locally — use to persist server-side. */
  onDismiss?: (notification: AppNotification) => void;
  /** Called after a dismissed notification is permanently deleted — use to persist server-side. */
  onDelete?: (id: string) => void;
}
