import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateTaskInput, TaskRow, UpdateTaskInput } from "./types";

export interface TasksHooksConfig {
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

export function createTasksHooks(config: TasksHooksConfig) {
  const { queryKey, table, tenantColumn, getTenantId, supabase, schema } = config;

  function useTasks(): UseQueryResult<TaskRow[]> {
    const tenantId = getTenantId();
    return useQuery({
      queryKey: [...queryKey, tenantId],
      queryFn: async () => {
        if (!tenantId) return [];
        const { data, error } = await fromTable(supabase, schema, table)
          .select("*")
          .eq(tenantColumn, tenantId)
          .order("due_date", { ascending: true })
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as TaskRow[];
      },
      enabled: Boolean(tenantId),
    });
  }

  function useCreateTask(): UseMutationResult<TaskRow, Error, CreateTaskInput> {
    const queryClient = useQueryClient();
    const tenantId = getTenantId();
    return useMutation({
      mutationFn: async (input: CreateTaskInput) => {
        if (!tenantId) throw new Error("Tenant no disponible");
        const { data, error } = await fromTable(supabase, schema, table)
          .insert({ ...input, [tenantColumn]: tenantId, status: input.status ?? "pendiente" })
          .select("*")
          .single();
        if (error) throw error;
        return data as TaskRow;
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey });
      },
    });
  }

  function useUpdateTask(): UseMutationResult<TaskRow, Error, UpdateTaskInput> {
    const queryClient = useQueryClient();
    const tenantId = getTenantId();
    return useMutation({
      mutationFn: async (input: UpdateTaskInput) => {
        if (!tenantId) throw new Error("Tenant no disponible");
        const { id, ...updates } = input;
        const { data, error } = await fromTable(supabase, schema, table)
          .update(updates)
          .eq("id", id)
          .eq(tenantColumn, tenantId)
          .select("*")
          .single();
        if (error) throw error;
        return data as TaskRow;
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey });
      },
    });
  }

  function useDeleteTask(): UseMutationResult<string, Error, string> {
    const queryClient = useQueryClient();
    const tenantId = getTenantId();
    return useMutation({
      mutationFn: async (taskId: string) => {
        if (!tenantId) throw new Error("Tenant no disponible");
        const { error } = await fromTable(supabase, schema, table)
          .delete()
          .eq("id", taskId)
          .eq(tenantColumn, tenantId);
        if (error) throw error;
        return taskId;
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey });
      },
    });
  }

  return { useTasks, useCreateTask, useUpdateTask, useDeleteTask };
}

export type TasksHooks = ReturnType<typeof createTasksHooks>;
