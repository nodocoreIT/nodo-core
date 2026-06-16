import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";

export interface AutoContractDefaults {
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  rent_amount: number | null;
  currency: string;
  adjustment_index: string;
  adjustment_period_months: number;
  commission_rate: number | null;
}

export function useAutoContractDefaults(propertyId?: string, tenantId?: string) {
  return useQuery<AutoContractDefaults | null>({
    queryKey: ["nodo_inmo", "auto-contract-defaults", propertyId, tenantId],
    enabled: !!(propertyId && tenantId),
    queryFn: async () => {
      if (!propertyId || !tenantId) return null;

      const { data: property } = await supabase
        .schema("nodo_inmo")
        .from("properties")
        .select(
          "sale_price, currency, commission_rate, owner:contacts!properties_owner_contact_id_fkey(commission_rate)",
        )
        .eq("id", propertyId)
        .single();

      if (!property) return null;

      const today = new Date();
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 24);

      const ownerRate = (
        property.owner as unknown as { commission_rate: number | null } | null
      )?.commission_rate;

      return {
        property_id: propertyId,
        tenant_id: tenantId,
        start_date: today.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        rent_amount: property.sale_price,
        currency: property.currency ?? "ARS",
        adjustment_index: "IPC",
        adjustment_period_months: 12,
        commission_rate: property.commission_rate ?? ownerRate ?? null,
      };
    },
  });
}
