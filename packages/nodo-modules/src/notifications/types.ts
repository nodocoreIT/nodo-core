import type { LucideIcon } from "lucide-react";

export type NotificationKind = string;

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  href: string;
  priority: number;
}

export interface NotificationKindStyle {
  icon: LucideIcon;
  iconColor: string;
}

export interface NotificationsDropdownProps {
  items: AppNotification[];
  count: number;
  loading?: boolean;
  error?: string | null;
  kindStyles: Record<string, NotificationKindStyle>;
  onNavigate: (href: string) => void;
  headerRingClass?: string;
}
