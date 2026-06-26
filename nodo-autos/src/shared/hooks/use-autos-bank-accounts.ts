import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BankAccount, BankAccountInput } from "@nodocore/nodo-modules/settings";
import { autosDb } from "@/shared/lib/supabase";
import { useVehicleStore } from "@/store/vehicle-store";

export const AUTOS_BANK_ACCOUNTS_QUERY_KEY = ["nodo-autos", "bank-accounts"] as const;
const CASH_MOVEMENTS_QUERY_KEY = ["nodo-autos", "cash-movements"];

const EMPTY_ACCOUNTS: BankAccount[] = [];

function getClienteId(): string | undefined {
  return useVehicleStore.getState().currentCliente?.id;
}

export function buildAccountLabel(bankName: string, currency: "ARS" | "USD"): string {
  return `${bankName} (${currency === "ARS" ? "Pesos" : "Dólares"})`;
}

function mapRow(row: Record<string, unknown>): BankAccount {
  return {
    id: row.id as string,
    label: row.label as string,
    currency: row.currency as "ARS" | "USD",
    kind: (row.kind as "BANCO" | "EFECTIVO") ?? "BANCO",
    bank_name: (row.bank_name as string | null) ?? null,
    alias: (row.alias as string | null) ?? null,
    cbu: (row.cbu as string | null) ?? null,
    initial_balance: Number(row.initial_balance ?? 0),
  };
}

async function createOpeningMovement(
  clienteId: string,
  account: BankAccount,
  amount: number,
): Promise<void> {
  if (amount <= 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await autosDb().from("cash_movements").insert({
    cliente_id: clienteId,
    type: "income",
    amount,
    currency: account.currency,
    date: today,
    concept: "Saldo inicial",
    category: account.label,
    source: "manual",
  });

  if (error) throw error;
}

export function useAutosBankAccounts() {
  const queryClient = useQueryClient();
  const clienteId = useVehicleStore((s) => s.currentCliente?.id);

  const query = useQuery<BankAccount[]>({
    queryKey: [...AUTOS_BANK_ACCOUNTS_QUERY_KEY, clienteId],
    queryFn: async () => {
      if (!clienteId) return [];

      const { data, error } = await autosDb()
        .from("cash_accounts")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true });

      if (error) throw error;
      return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
    },
    enabled: Boolean(clienteId),
    staleTime: 30_000,
  });

  const addAccount = useMutation({
    mutationFn: async (input: BankAccountInput) => {
      const tenantId = getClienteId();
      if (!tenantId) throw new Error("Cliente no identificado");

      const label = buildAccountLabel(input.bank_name.trim(), input.currency);
      const initialBalance = input.initial_balance ?? 0;

      const { data, error } = await autosDb()
        .from("cash_accounts")
        .insert({
          cliente_id: tenantId,
          label,
          currency: input.currency,
          kind: "BANCO",
          bank_name: input.bank_name.trim(),
          alias: input.alias?.trim() || null,
          cbu: input.cbu?.trim() || null,
          initial_balance: initialBalance,
          sort_order: 99,
        })
        .select()
        .single();

      if (error) throw error;
      const account = mapRow(data as Record<string, unknown>);
      await createOpeningMovement(tenantId, account, initialBalance);
      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTOS_BANK_ACCOUNTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CASH_MOVEMENTS_QUERY_KEY });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, ...input }: BankAccountInput & { id: string }) => {
      const label = buildAccountLabel(input.bank_name.trim(), input.currency);

      const { data, error } = await autosDb()
        .from("cash_accounts")
        .update({
          label,
          currency: input.currency,
          bank_name: input.bank_name.trim(),
          alias: input.alias?.trim() || null,
          cbu: input.cbu?.trim() || null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return mapRow(data as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTOS_BANK_ACCOUNTS_QUERY_KEY });
    },
  });

  const removeAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await autosDb().from("cash_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTOS_BANK_ACCOUNTS_QUERY_KEY });
    },
  });

  return {
    accounts: query.data ?? EMPTY_ACCOUNTS,
    isLoading: query.isLoading,
    addAccount: addAccount.mutateAsync,
    updateAccount: async (id: string, input: BankAccountInput) =>
      updateAccountMutation.mutateAsync({ id, ...input }),
    removeAccount: removeAccount.mutateAsync,
    isAdding: addAccount.isPending,
    isUpdating: updateAccountMutation.isPending,
    isRemoving: removeAccount.isPending,
  };
}
