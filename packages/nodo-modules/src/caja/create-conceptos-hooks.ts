import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ConceptoRow {
  id: string;
  name: string;
  created_at: string;
}

export interface ConceptosHooksConfig {
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

export function createConceptosHooks(config: ConceptosHooksConfig) {
  const { queryKey, table, tenantColumn, getTenantId, supabase, schema } = config;

  function useConceptos(): UseQueryResult<ConceptoRow[]> {
    const tenantId = getTenantId();
    return useQuery({
      queryKey: [...queryKey, tenantId],
      queryFn: async () => {
        if (!tenantId) return [];
        const { data, error } = await fromTable(supabase, schema, table)
          .select("*")
          .eq(tenantColumn, tenantId)
          .order("name", { ascending: true });
        if (error) throw error;
        return (data ?? []) as ConceptoRow[];
      },
      enabled: Boolean(tenantId),
    });
  }

  function useCreateConcepto(): UseMutationResult<ConceptoRow, Error, string> {
    const queryClient = useQueryClient();
    const tenantId = getTenantId();
    return useMutation({
      mutationFn: async (name: string) => {
        if (!tenantId) throw new Error("Tenant no disponible");
        const trimmed = name.trim();
        if (!trimmed) throw new Error("El concepto no puede estar vacío");

        const { data: existing, error: findError } = await fromTable(supabase, schema, table)
          .select("*")
          .eq(tenantColumn, tenantId)
          .eq("name", trimmed)
          .maybeSingle();
        if (findError) throw findError;
        if (existing) return existing as ConceptoRow;

        const { data, error } = await fromTable(supabase, schema, table)
          .insert({ name: trimmed, [tenantColumn]: tenantId })
          .select("*")
          .single();
        if (error) throw error;
        return data as ConceptoRow;
      },
      onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    });
  }

  return { useConceptos, useCreateConcepto };
}

export type ConceptosHooks = ReturnType<typeof createConceptosHooks>;
