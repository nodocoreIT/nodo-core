import { useEffect, useMemo } from "react";
import { useAuth } from "@nodocore/shared-components";
import { useTasks } from "@/features/agenda/hooks/use-tasks";
import { useStaffStore } from "@/shared/hooks/use-staff";
import { useDashboardMetrics } from "./use-dashboard-metrics";
import { buildNotifications, type AppNotification } from "../lib/build-notifications";

export interface NotificationsState {
  items: AppNotification[];
  count: number;
  loading: boolean;
  error: unknown;
}

export function useNotifications(today: Date = new Date()): NotificationsState {
  const { role, user } = useAuth();
  const tasks = useTasks();
  const metrics = useDashboardMetrics(today);
  const { users: staffUsers, fetchMembers } = useStaffStore();

  useEffect(() => {
    if (staffUsers.length === 0) {
      void fetchMembers();
    }
  }, [staffUsers.length, fetchMembers]);

  const currentUserName = useMemo(
    () => staffUsers.find((u) => u.id === user?.id)?.name ?? null,
    [staffUsers, user?.id],
  );

  const loading = tasks.isLoading || metrics.loading;
  const error = tasks.error ?? metrics.error ?? null;

  const items = useMemo(() => {
    if (loading || error) return [];
    return buildNotifications(tasks.data ?? [], metrics, {
      isAdmin: role === "admin" || role === "super_admin",
      today,
      currentUserName,
    });
  }, [tasks.data, metrics, role, today, loading, error, currentUserName]);

  return {
    items,
    count: items.length,
    loading,
    error,
  };
}
