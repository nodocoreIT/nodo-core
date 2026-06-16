import { useState } from "react";
import { useMyPayments, type MyPaymentWithRelations } from "../hooks/use-my-payments";
import { cn } from "@/shared/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterTab = "all" | "pending" | "paid";

// ── Helpers ───────────────────────────────────────────────────────────────────

function effectiveStatus(payment: MyPaymentWithRelations): string {
  if (payment.status === "pending") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(payment.due_date);
    due.setHours(0, 0, 0, 0);
    if (due < today) return "overdue";
  }
  return payment.status;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPeriod(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: {
      label: "Pendiente",
      className: "bg-yellow-100 text-yellow-700",
    },
    paid: {
      label: "Pagado",
      className: "bg-green-100 text-green-700",
    },
    overdue: {
      label: "Vencido",
      className: "bg-red-100 text-red-700",
    },
  };
  const config = map[status] ?? {
    label: status,
    className: "bg-mist text-slate2",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function TenantPaymentsPage() {
  const { data: payments = [], isLoading, error } = useMyPayments();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "pending", label: "Pendientes" },
    { key: "paid", label: "Pagados" },
  ];

  const filtered = payments.filter((p) => {
    if (activeTab === "all") return true;
    const status = effectiveStatus(p);
    if (activeTab === "pending") return status === "pending" || status === "overdue";
    if (activeTab === "paid") return status === "paid";
    return true;
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 w-fit shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-brand text-white shadow-sm"
                : "text-slate2 hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-mist" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-red-600">
          Error al cargar los pagos. Intentá de nuevo más tarde.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-slate2">No hay pagos para mostrar.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-mist/30">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate2">
                  Período
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate2">
                  Vencimiento
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate2">
                  Importe
                </th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate2">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((payment) => {
                const status = effectiveStatus(payment);
                return (
                  <tr key={payment.id} className="hover:bg-mist/20 transition-colors">
                    <td className="px-4 py-3 text-foreground capitalize">
                      {formatPeriod(payment.due_date)}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {formatDate(payment.due_date)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {payment.currency}{" "}
                      {payment.amount.toLocaleString("es-AR")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <StatusChip status={status} />
                        {status === "paid" && payment.payment_method && (
                          <span className="text-[10px] text-slate2 capitalize">
                            {payment.payment_method}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
