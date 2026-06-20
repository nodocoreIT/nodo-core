import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@nodocore/shared-components";
import { supabase } from "@/shared/lib/supabase";
import type { PaymentRow, PaymentInsert } from "@/shared/types/database";

export type PaymentWithOrder = PaymentRow & {
  order: { id: string; order_number: string; total: number } | null;
};

export function usePayments() {
  const { orgId } = useAuth();

  return useQuery<PaymentWithOrder[]>({
    queryKey: ["nodo_tienda", "payments", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("payments")
        .select(`*, order:orders(id, order_number, total)`)
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentWithOrder[];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

export function useRegisterPayment() {
  const { orgId } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: Omit<PaymentInsert, "org_id">) => {
      const { data, error } = await supabase
        .schema("nodo_tienda")
        .from("payments")
        .insert({ ...params, org_id: orgId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nodo_tienda", "payments"] });
    },
  });
}
