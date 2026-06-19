import { useMemo } from "react";
import {
  CajaModuleProvider,
  CajaPage,
  type CajaModuleContextValue,
  type CreateCashMovementInput,
  type UpdateCashMovementInput,
} from "@nodocore/nodo-modules/caja";
import { autosCajaHooks } from "@/shared/lib/autos-module-hooks";

function formatMoney(amount: number, currency: "ARS" | "USD"): string {
  const prefix = currency === "USD" ? "US$" : "$";
  return `${prefix} ${amount.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function AutosCajaPage() {
  const { data: movements = [], isLoading, isError } = autosCajaHooks.useCashMovements();
  const createMutation = autosCajaHooks.useCreateCashMovement();
  const updateMutation = autosCajaHooks.useUpdateCashMovement();
  const deleteMutation = autosCajaHooks.useDeleteCashMovement();

  const moduleValue = useMemo((): CajaModuleContextValue => {
    return {
      movements,
      isLoading,
      isError,
      createMovement: (input: CreateCashMovementInput) => createMutation.mutateAsync(input),
      updateMovement: (input: UpdateCashMovementInput) => updateMutation.mutateAsync(input),
      deleteMovement: (id: string) => deleteMutation.mutateAsync(id),
      isSaving:
        createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
      formatMoney,
      formatDate,
      accountOptions: [
        { value: "caja", label: "Caja general" },
        { value: "banco", label: "Cuenta bancaria" },
      ],
      conceptOptions: [
        "Seña",
        "Venta",
        "Comisión",
        "Gastos administrativos",
        "Transferencia",
        "Otros",
      ],
    };
  }, [movements, isLoading, isError, createMutation, updateMutation, deleteMutation]);

  return (
    <CajaModuleProvider value={moduleValue}>
      <CajaPage />
    </CajaModuleProvider>
  );
}
