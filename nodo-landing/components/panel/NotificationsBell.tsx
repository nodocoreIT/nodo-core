"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  CreditCard,
  Lightbulb,
  UserPlus,
  Wallet,
} from "lucide-react";
import { NotificationsDropdown } from "@nodocore/nodo-modules/notifications";
import { usePanelNotifications } from "@/hooks/use-panel-notifications";

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
  default: {
    icon: AlertTriangle,
    iconColor: "text-slate2 bg-slate-100",
  },
};

export function NotificationsBell() {
  const router = useRouter();
  const { items, loading, error } = usePanelNotifications();

  return (
    <NotificationsDropdown
      items={items}
      loading={loading}
      error={error}
      kindStyles={PANEL_NOTIFICATION_KIND_STYLES}
      onNavigate={(href) => router.push(href)}
      headerRingClass="ring-[#EEF3F8]"
      storageKey="panel"
    />
  );
}
