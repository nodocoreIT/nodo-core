"use client";

import { useCallback, useEffect, useState } from "react";
import { clinicApi } from "@/lib/clinic/client-api";
import type { AppNotification } from "@nodocore/nodo-modules/notifications";

export function useClinicNotifications(doctorId: string | null) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!doctorId) return;
    try {
      const [cobros, appointments] = await Promise.all([
        clinicApi.getCobrosUnreadCount(),
        clinicApi.getDoctorAppointments(doctorId, "today"),
      ]);

      const notifications: AppNotification[] = [];

      if (cobros.cobrosCount > 0) {
        notifications.push({
          id: "pending-cobros",
          kind: "pending_cobros",
          title: `${cobros.cobrosCount} cobro${cobros.cobrosCount === 1 ? "" : "s"} pendiente${cobros.cobrosCount === 1 ? "" : "s"}`,
          description: "Revisá los comprobantes de pago de tus pacientes.",
          href: "/medico/cobros",
          priority: 1,
        });
      }

      const todayCount = Array.isArray(appointments) ? appointments.length : 0;
      if (todayCount > 0) {
        notifications.push({
          id: "today-appointments",
          kind: "today_appointments",
          title: `${todayCount} turno${todayCount === 1 ? "" : "s"} hoy`,
          description: "Revisá tu agenda del día en el consultorio.",
          href: "/medico/consultorio",
          priority: 2,
        });
      }

      setItems(notifications);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    const onCobrosRead = () => refresh();
    window.addEventListener("cobros-notifications-read", onCobrosRead);
    return () => {
      clearInterval(interval);
      window.removeEventListener("cobros-notifications-read", onCobrosRead);
    };
  }, [refresh]);

  return { items, loading, error };
}
