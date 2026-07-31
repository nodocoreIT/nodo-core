import { useEffect, useMemo, useState } from "react";
import { Coins, X } from "lucide-react";
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

const NODO_LANDING_URL =
  (import.meta.env.VITE_NODO_LANDING_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://nodocore.com.ar";

const FINANZAS_BANNER_DISMISSED_KEY = "autos_finanzas_banner_dismissed";

function FinanzasBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(FINANZAS_BANNER_DISMISSED_KEY) === "1");
  }, []);

  if (dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-2.5 text-sm text-emerald-900">
      <Coins className="h-4 w-4 shrink-0 text-emerald-600" />
      <p className="flex-1">
        Ya tenés Nodo Autos — ¿te gustaría anexar{" "}
        <a
          href={`${NODO_LANDING_URL}/nodo-finanzas`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2 hover:text-emerald-700"
        >
          Nodo Finanzas
        </a>{" "}
        para llevar el control de tus ingresos?
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(FINANZAS_BANNER_DISMISSED_KEY, "1");
          setDismissed(true);
        }}
        aria-label="Cerrar"
        className="shrink-0 rounded p-1 text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

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
      banner: <FinanzasBanner />,
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
