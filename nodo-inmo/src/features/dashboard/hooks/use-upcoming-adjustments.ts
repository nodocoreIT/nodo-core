import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useAuth } from "@nodocore/shared-components";
import { useAlertSettings } from "@/shared/hooks/use-alert-settings";

export interface UpcomingAdjustment {
  contractId: string;
  tenantName: string;
  propertyAddress: string;
  nextAdjustmentDate: string;  // ISO date
  adjustmentIndex: string;     // "IPC" | "ICL" | "fixed" | "USD"
  rentAmount: number;
  currency: string;
}

export const UPCOMING_ADJUSTMENTS_KEY = ["dashboard", "upcoming-adjustments"] as const;

export function useUpcomingAdjustments() {
  const { orgId } = useAuth();
  const { settings: alertSettings, isLoading: isSettingsLoading } = useAlertSettings();

  return useQuery({
    queryKey: [...UPCOMING_ADJUSTMENTS_KEY, orgId, alertSettings.rentAdjustmentMonths],
    enabled: !!orgId && !isSettingsLoading,
    queryFn: async (): Promise<UpcomingAdjustment[]> => {
      const today = new Date();
      const inDays = new Date();
      const daysAhead = alertSettings.rentAdjustmentMonths * 30;
      inDays.setDate(today.getDate() + daysAhead);

      const { data, error } = await supabase
        .schema("nodo_inmo")
        .from("contracts")
        .select(`
          id,
          next_adjustment_date,
          adjustment_index,
          rent_amount,
          currency,
          contacts:tenant_id ( name ),
          properties:property_id ( address )
        `)
        .eq("org_id", orgId!)
        .eq("status", "active")
        .not("next_adjustment_date", "is", null)
        .gte("next_adjustment_date", today.toISOString().substring(0, 10))
        .lte("next_adjustment_date", inDays.toISOString().substring(0, 10))
        .order("next_adjustment_date", { ascending: true });

      if (error) throw error;
      if (!data) return [];

      return data.map((row: any) => ({
        contractId: row.id,
        tenantName: row.contacts?.name ?? "Inquilino",
        propertyAddress: row.properties?.address ?? "Propiedad",
        nextAdjustmentDate: row.next_adjustment_date,
        adjustmentIndex: row.adjustment_index,
        rentAmount: row.rent_amount,
        currency: row.currency,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}
