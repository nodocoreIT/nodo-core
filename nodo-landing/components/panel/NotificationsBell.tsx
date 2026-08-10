"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  ClipboardList,
  CreditCard,
  Lightbulb,
  MessageSquare,
  UserCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { NotificationsDropdown } from "@nodocore/nodo-modules/notifications";
import type { AppNotification, DismissedNotification } from "@nodocore/nodo-modules/notifications";

export const PANEL_NOTIFICATION_KIND_STYLES = {
  pending_registration: {
    icon: UserPlus,
    iconColor: "text-brand bg-brand/10",
  },
  pending_onboarding: {
    icon: ClipboardList,
    iconColor: "text-amber-600 bg-amber-50",
  },
  onboarding_stuck: {
    icon: AlertTriangle,
    iconColor: "text-rose-600 bg-rose-50",
  },
  demo_expiring: {
    icon: CreditCard,
    iconColor: "text-violet-600 bg-violet-50",
  },
  pending_caja: {
    icon: Wallet,
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
  new_idea: {
    icon: Lightbulb,
    iconColor: "text-amber-600 bg-amber-50",
  },
  new_feedback: {
    icon: MessageSquare,
    iconColor: "text-indigo-600 bg-indigo-50",
  },
  status_changed: {
    icon: ArrowRightLeft,
    iconColor: "text-brand bg-brand/10",
  },
  reassigned: {
    icon: UserCheck,
    iconColor: "text-emerald-600 bg-emerald-50",
  },
  default: {
    icon: AlertTriangle,
    iconColor: "text-slate2 bg-slate-100",
  },
};

export interface NotificationsBellProps {
  items: AppNotification[];
  loading: boolean;
  error: string | null;
  dismissedFromServer: DismissedNotification[];
  onDismiss: (notification: AppNotification) => void;
  onDelete: (id: string) => void;
}

/**
 * Presentational only — the data comes from a single usePanelNotifications()
 * call in Topbar.tsx, shared by both the mobile and desktop bell instances.
 * They can't share the hook call itself: the two header layouts are
 * CSS-only responsive (both always mounted), so calling the hook inside
 * this component would poll, subscribe to realtime, and toast twice per
 * event for every panel page.
 */
export function NotificationsBell({
  items,
  loading,
  error,
  dismissedFromServer,
  onDismiss,
  onDelete,
}: NotificationsBellProps) {
  const router = useRouter();

  return (
    <NotificationsDropdown
      items={items}
      loading={loading}
      error={error}
      kindStyles={PANEL_NOTIFICATION_KIND_STYLES}
      onNavigate={(href) => router.push(href)}
      headerRingClass="ring-[#EEF3F8]"
      storageKey="panel"
      initialDismissed={dismissedFromServer}
      onDismiss={onDismiss}
      onDelete={onDelete}
    />
  );
}
