import { useMemo } from "react";
import {
  CajaModuleProvider,
  CajaPage,
  type CajaModuleContextValue,
  type CreateCashMovementInput,
  type UpdateCashMovementInput,
} from "@nodocore/nodo-modules/caja";
import {
  autosCajaHooks,
  autosConceptosHooks,
  autosCashAccountsHooks,
} from "@/shared/lib/autos-module-hooks";

function formatMoney(amount: number, currency: "ARS" | "USD"): string {
  const prefix = currency === "USD" ? "US$" : "$";
  return `${prefix} ${amount.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

const DEFAULT_CONCEPTS = [
  "Seña",
  "Venta",
  "Comisión",
  "Gastos administrativos",
  "Transferencia",
  "Otros",
];

export function AutosCajaPage() {
  const { data: movements = [], isLoading, isError } = autosCajaHooks.useCashMovements();
  const createMutation = autosCajaHooks.useCreateCashMovement();
  const updateMutation = autosCajaHooks.useUpdateCashMovement();
  const deleteMutation = autosCajaHooks.useDeleteCashMovement();
  const { data: conceptos = [] } = autosConceptosHooks.useConceptos();
  const createConceptoMutation = autosConceptosHooks.useCreateConcepto();
  const { data: cashAccounts = [] } = autosCashAccountsHooks.useCashAccounts();

  const moduleValue = useMemo((): CajaModuleContextValue => {
    const accountOptions =
      cashAccounts.length > 0
        ? cashAccounts.map((account) => ({
            value: account.label,
            label: account.label,
            currency: account.currency,
          }))
        : [
            { value: "Caja general", label: "Caja general", currency: "ARS" as const },
            { value: "Cuenta bancaria", label: "Cuenta bancaria", currency: "ARS" as const },
          ];

    const conceptOptions = [
      ...new Set([
        ...DEFAULT_CONCEPTS,
        ...conceptos.map((concepto) => concepto.name),
      ]),
    ];

    return {
      movements,
      isLoading,
      isError,
      createMovement: (input: CreateCashMovementInput) => createMutation.mutateAsync(input),
      updateMovement: (input: UpdateCashMovementInput) => updateMutation.mutateAsync(input),
      deleteMovement: (movement) => deleteMutation.mutateAsync(movement.id),
      isSaving:
        createMutation.isPending || updateMutation.isPending || createConceptoMutation.isPending,
      isDeleting: deleteMutation.isPending,
      formatMoney,
      formatDate,
      accountOptions,
      conceptOptions,
      sourceLabels: { manual: "Manual" },
      emptyMessage: "Todavía no hay movimientos. Registrá ingresos y egresos manualmente.",
      createConcepto: (name) => createConceptoMutation.mutateAsync(name).then(() => undefined),
    };
  }, [
    movements,
    isLoading,
    isError,
    cashAccounts,
    conceptos,
    createMutation,
    updateMutation,
    deleteMutation,
    createConceptoMutation,
  ]);

  return (
    <CajaModuleProvider value={moduleValue}>
      <CajaPage />
    </CajaModuleProvider>
  );
}
