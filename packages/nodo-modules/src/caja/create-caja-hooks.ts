import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CashMovementRow, CreateCashMovementInput, UpdateCashMovementInput } from "./types";

export interface CajaHooksConfig {
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

export function createCajaHooks(config: CajaHooksConfig) {
  const { queryKey, table, tenantColumn, getTenantId, supabase, schema } = config;

  function useCashMovements(): UseQueryResult<CashMovementRow[]> {
    const tenantId = getTenantId();
    return useQuery({
      queryKey: [...queryKey, tenantId],
      queryFn: async () => {
        if (!tenantId) return [];
        const { data, error } = await fromTable(supabase, schema, table)
          .select("*")
          .eq(tenantColumn, tenantId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as CashMovementRow[];
      },
      enabled: Boolean(tenantId),
    });
  }

  function useCreateCashMovement(): UseMutationResult<void, Error, CreateCashMovementInput> {
    const queryClient = useQueryClient();
    const tenantId = getTenantId();
    return useMutation({
      mutationFn: async (input) => {
        if (!tenantId) throw new Error("Tenant no disponible");
        const { error } = await fromTable(supabase, schema, table).insert({
          ...input,
          [tenantColumn]: tenantId,
          source: "manual",
        });
        if (error) throw error;
      },
      onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    });
  }

  function useUpdateCashMovement(): UseMutationResult<void, Error, UpdateCashMovementInput> {
    const queryClient = useQueryClient();
    const tenantId = getTenantId();
    return useMutation({
      mutationFn: async ({ id, ...updates }) => {
        if (!tenantId) throw new Error("Tenant no disponible");
        const { error } = await fromTable(supabase, schema, table)
          .update(updates)
          .eq("id", id)
          .eq(tenantColumn, tenantId);
        if (error) throw error;
      },
      onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    });
  }

  function useDeleteCashMovement(): UseMutationResult<void, Error, string> {
    const queryClient = useQueryClient();
    const tenantId = getTenantId();
    return useMutation({
      mutationFn: async (id) => {
        if (!tenantId) throw new Error("Tenant no disponible");
        const { error } = await fromTable(supabase, schema, table)
          .delete()
          .eq("id", id)
          .eq(tenantColumn, tenantId);
        if (error) throw error;
      },
      onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    });
  }

  return {
    useCashMovements,
    useCreateCashMovement,
    useUpdateCashMovement,
    useDeleteCashMovement,
  };
}

export type CajaHooks = ReturnType<typeof createCajaHooks>;
