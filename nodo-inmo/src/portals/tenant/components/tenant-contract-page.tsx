import { useMyContract } from "../hooks/use-my-contract";
import { cn } from "@/shared/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("es-AR")}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate2">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function ContractStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Activo", className: "bg-green-100 text-green-700" },
    expired: { label: "Vencido", className: "bg-red-100 text-red-700" },
    terminated: { label: "Rescindido", className: "bg-gray-100 text-gray-600" },
  };
  const config = map[status] ?? { label: status, className: "bg-mist text-slate2" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function TenantContractPage() {
  const { data: contract, isLoading, error } = useMyContract();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-mist" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 text-center text-sm text-red-600">
        Error al cargar el contrato. Intentá de nuevo más tarde.
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-slate2">No se encontró un contrato activo.</p>
      </div>
    );
  }

  const { property } = contract;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">
            {property?.address ?? "Propiedad sin dirección"}
          </h2>
          {property?.rooms != null && (
            <p className="mt-0.5 text-sm text-slate2">
              {property.rooms} ambientes
              {property.total_sqm != null ? ` · ${property.total_sqm} m²` : ""}
            </p>
          )}
        </div>
        <ContractStatusBadge status={contract.status} />
      </div>

      {/* Contract details grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCell label="Inicio del contrato" value={formatDate(contract.start_date)} />
        <InfoCell label="Fin del contrato" value={formatDate(contract.end_date)} />
        <InfoCell
          label="Alquiler mensual"
          value={formatMoney(contract.rent_amount, contract.currency)}
        />
        <InfoCell label="Índice de ajuste" value={contract.adjustment_index} />
        <InfoCell
          label="Próximo ajuste"
          value={formatDate(contract.next_adjustment_date)}
        />
        <InfoCell
          label="Período de ajuste"
          value={`Cada ${contract.adjustment_period_months} meses`}
        />
      </div>

      {/* Parties */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate2">
          Partes del contrato
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate2">
              Propietario
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {property?.owner?.name ?? "—"}
            </p>
            {property?.owner?.phone && (
              <p className="text-xs text-slate2">{property.owner.phone}</p>
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate2">
              Inquilino
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">Vos</p>
          </div>
        </div>
      </div>
    </div>
  );
}
