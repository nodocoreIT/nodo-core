"use client";

import { useRouter } from "next/navigation";
import { Calendar, CreditCard } from "lucide-react";
import { NotificationsDropdown } from "@nodocore/nodo-modules/notifications";
import type { NotificationKindStyle } from "@nodocore/nodo-modules/notifications";
import { useClinicNotifications } from "@/hooks/use-clinic-notifications";

const KIND_STYLES: Record<string, NotificationKindStyle> = {
  pending_cobros: {
    icon: CreditCard,
    iconColor: "text-amber-600 bg-amber-50",
  },
  today_appointments: {
    icon: Calendar,
    iconColor: "text-brand bg-brand/10",
  },
  default: {
    icon: CreditCard,
    iconColor: "text-slate2 bg-slate-100",
  },
};

interface ClinicNotificationsBellProps {
  doctorId: string;
}

export function ClinicNotificationsBell({ doctorId }: ClinicNotificationsBellProps) {
  const router = useRouter();
  const { items, loading, error } = useClinicNotifications(doctorId);

  return (
    <NotificationsDropdown
      items={items}
      loading={loading}
      error={error ? "No se pudieron cargar las notificaciones." : null}
      kindStyles={KIND_STYLES}
      onNavigate={(href) => router.push(href)}
      headerRingClass="ring-[#EEF3F8]"
      storageKey="clinica"
    />
  );
}
