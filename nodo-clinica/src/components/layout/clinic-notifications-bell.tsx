"use client";

import { useRouter } from "next/navigation";
import { Calendar, CreditCard, Wallet } from "lucide-react";
import { NotificationsDropdown } from "@nodocore/nodo-modules/notifications";
import type { AppNotification, NotificationKindStyle } from "@nodocore/nodo-modules/notifications";
import { useClinicNotifications } from "@/hooks/use-clinic-notifications";

const KIND_STYLES: Record<string, NotificationKindStyle> = {
  mercadopago_payment: {
    icon: Wallet,
    iconColor: "text-emerald-600 bg-emerald-50",
  },
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
  /** Durante videoconsulta: no navegar (cortaría la sesión). */
  navigationDisabled?: boolean;
  onNavigationBlocked?: () => void;
}

export function ClinicNotificationsBell({
  doctorId,
  navigationDisabled = false,
  onNavigationBlocked,
}: ClinicNotificationsBellProps) {
  const router = useRouter();
  const { items, loading, error, markMercadoPagoPaymentRead } =
    useClinicNotifications(doctorId);

  const consumeIfMpPayment = (notif: AppNotification) => {
    if (notif.kind === "mercadopago_payment") {
      void markMercadoPagoPaymentRead(notif.id);
    }
  };

  return (
    <NotificationsDropdown
      items={items}
      loading={loading}
      error={error ? "No se pudieron cargar las notificaciones." : null}
      kindStyles={KIND_STYLES}
      onNavigate={(href) => {
        if (navigationDisabled) {
          onNavigationBlocked?.();
          return;
        }
        router.push(href);
      }}
      onDismiss={consumeIfMpPayment}
      headerRingClass="ring-[#EEF3F8]"
      storageKey="clinica"
    />
  );
}
