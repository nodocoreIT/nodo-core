import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CashAccountRow {
  id: string;
  label: string;
  currency: "ARS" | "USD";
}

export interface CashAccountsHooksConfig {
  queryKey: readonly unknown[];
  table: string;
  tenantColumn: string;
  getTenantId: () => string | null | undefined;
  supabase: SupabaseClient;
  schema?: string;
}

function fromTable(supabase: SupabaseClient, schema: string | undefined, table: string) {
  return schema ? supabase.schema(schema).from(table) : supabase.from(table);
}

export function createCashAccountsHooks(config: CashAccountsHooksConfig) {
  const { queryKey, table, tenantColumn, getTenantId, supabase, schema } = config;

  function useCashAccounts(): UseQueryResult<CashAccountRow[]> {
    const tenantId = getTenantId();
    return useQuery({
      queryKey: [...queryKey, tenantId],
      queryFn: async () => {
        if (!tenantId) return [];
        const { data, error } = await fromTable(supabase, schema, table)
          .select("id, label, currency")
          .eq(tenantColumn, tenantId)
          .order("label", { ascending: true });
        if (error) throw error;
        return (data ?? []) as CashAccountRow[];
      },
      enabled: Boolean(tenantId),
    });
  }

  return { useCashAccounts };
}

export type CashAccountsHooks = ReturnType<typeof createCashAccountsHooks>;
