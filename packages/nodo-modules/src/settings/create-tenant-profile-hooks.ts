import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantProfileRow, TenantProfileUpdate } from "./types";

export interface TenantProfileHooksConfig {
  queryKey: readonly unknown[];
  table: string;
  tenantColumn: string;
  getTenantId: () => string | null | undefined;
  supabase: SupabaseClient;
  schema?: string;
  mapRow?: (row: Record<string, unknown>) => TenantProfileRow;
  mapUpdate?: (input: TenantProfileUpdate) => Record<string, unknown>;
}

function fromTable(supabase: SupabaseClient, schema: string | undefined, table: string) {
  return schema ? supabase.schema(schema).from(table) : supabase.from(table);
}

const defaultMapRow = (row: Record<string, unknown>): TenantProfileRow => ({
  legal_name: (row.legal_name as string | null) ?? null,
  address: (row.address as string | null) ?? null,
  cuit: (row.cuit as string | null) ?? null,
  phone: (row.phone as string | null) ?? null,
  email: (row.email as string | null) ?? null,
  logo_path: (row.logo_path as string | null) ?? null,
  pdf_logo_path: (row.pdf_logo_path as string | null) ?? null,
  theme_settings: row.theme_settings,
  alert_settings: row.alert_settings,
  ai_settings: row.ai_settings,
});

export function createTenantProfileHooks(config: TenantProfileHooksConfig) {
  const {
    queryKey,
    table,
    tenantColumn,
    getTenantId,
    supabase,
    schema,
    mapRow = defaultMapRow,
    mapUpdate = (input) => input as Record<string, unknown>,
  } = config;

  function useTenantProfile() {
    const tenantId = getTenantId();
    return useQuery<TenantProfileRow | null>({
      queryKey: [...queryKey, tenantId],
      queryFn: async () => {
        if (!tenantId) return null;
        const { data, error } = await fromTable(supabase, schema, table)
          .select("*")
          .eq(tenantColumn, tenantId)
          .maybeSingle();
        if (error) throw error;
        return data ? mapRow(data as Record<string, unknown>) : null;
      },
      enabled: Boolean(tenantId),
      staleTime: 30_000,
    });
  }

  function useUpsertTenantProfile() {
    const queryClient = useQueryClient();
    const tenantId = getTenantId();

    return useMutation({
      mutationFn: async (input: TenantProfileUpdate) => {
        if (!tenantId) throw new Error("Tenant no identificado");
        const payload = mapUpdate(input);
        const { error } = await fromTable(supabase, schema, table)
          .update(payload)
          .eq(tenantColumn, tenantId);
        if (error) throw error;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey });
      },
    });
  }

  return { useTenantProfile, useUpsertTenantProfile };
}

export type TenantProfileHooks = ReturnType<typeof createTenantProfileHooks>;
