import { HandCoins } from "lucide-react";
import { useMySettlements, type OwnerSettlement } from "../hooks/use-my-settlements";
import { cn } from "@/shared/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency || "ARS",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(dateStr));
}

const STATUS_CONFIG: Record<OwnerSettlement["status"], { label: string; className: string }> = {
  pending: {
    label: "Pendiente",
    className: "bg-yellow-100 text-yellow-800",
  },
  settled: {
    label: "Acreditado",
    className: "bg-green-100 text-green-800",
  },
};

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ settlements }: { settlements: OwnerSettlement[] }) {
  const currentYear = new Date().getFullYear();

  const pendingTotal = settlements
    .filter((s) => s.status === "pending")
    .reduce((sum, s) => sum + s.amount, 0);

  const settledThisYear = settlements
    .filter(
      (s) =>
        s.status === "settled" &&
        s.settled_date &&
        new Date(s.settled_date).getFullYear() === currentYear,
    )
    .reduce((sum, s) => sum + s.amount, 0);

  // Use ARS as default currency for summary; most cases will have uniform currency
  const sampleCurrency = settlements[0]?.currency ?? "ARS";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700">
          Pendiente de acreditación
        </p>
        <p className="mt-1 text-2xl font-bold text-yellow-900">
          {formatCurrency(pendingTotal, sampleCurrency)}
        </p>
      </div>
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
          Acreditado {currentYear}
        </p>
        <p className="mt-1 text-2xl font-bold text-green-900">
          {formatCurrency(settledThisYear, sampleCurrency)}
        </p>
      </div>
    </div>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

function SettlementRow({ settlement }: { settlement: OwnerSettlement }) {
  const statusConfig = STATUS_CONFIG[settlement.status];
  const address = settlement.payment?.contract?.property?.address ?? "—";
  const dueDate = settlement.payment?.due_date ?? null;
  const grossAmount = settlement.payment?.amount ?? 0;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-mist/40 transition-colors">
      <td className="py-3 pl-4 pr-3 text-sm text-navy font-medium">{address}</td>
      <td className="px-3 py-3 text-sm text-slate2">{formatDate(dueDate)}</td>
      <td className="px-3 py-3 text-sm text-slate2 text-right">
        {formatCurrency(grossAmount, settlement.currency)}
      </td>
      <td className="px-3 py-3 text-sm font-medium text-navy text-right">
        {formatCurrency(settlement.amount, settlement.currency)}
      </td>
      <td className="px-3 py-3">
        <span
          className={cn(
            "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
            statusConfig.className,
          )}
        >
          {statusConfig.label}
        </span>
      </td>
      <td className="px-3 py-3 pr-4 text-sm text-slate2 text-right">
        {formatDate(settlement.settled_date)}
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function OwnerSettlementsPage() {
  const { data: settlements = [], isLoading, error } = useMySettlements();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate2">Cargando rendiciones...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">No se pudieron cargar las rendiciones.</p>
      </div>
    );
  }

  if (settlements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mist">
          <HandCoins className="h-7 w-7 text-slate2" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-navy">Sin rendiciones</p>
          <p className="mt-1 text-sm text-slate2">
            Todavía no hay rendiciones registradas para tu cuenta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SummaryBar settlements={settlements} />

      {/* Table — scrollable on mobile */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-mist">
            <tr>
              <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate2">
                Propiedad
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate2">
                Período
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate2">
                Importe bruto
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate2">
                Neto
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate2">
                Estado
              </th>
              <th className="px-3 py-3 pr-4 text-right text-xs font-semibold uppercase tracking-wide text-slate2">
                Fecha de pago
              </th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((settlement) => (
              <SettlementRow key={settlement.id} settlement={settlement} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
