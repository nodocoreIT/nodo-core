import { Link } from "react-router-dom";
import { FileText, CreditCard, MessageSquare, AlertCircle } from "lucide-react";
import { useMyContact } from "../hooks/use-my-contact";
import { useMyContract } from "../hooks/use-my-contract";
import { useMyPayments } from "../hooks/use-my-payments";
import { cn } from "@/shared/lib/utils";

// ── Status badge ──────────────────────────────────────────────────────────────

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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

// ── Quick link card ───────────────────────────────────────────────────────────

function QuickLink({
  to,
  icon: Icon,
  label,
  description,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-slate2">{description}</p>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function TenantHomePage() {
  const { data: contact, isLoading: loadingContact } = useMyContact();
  const { data: contract, isLoading: loadingContract } = useMyContract();
  const { data: payments = [], isLoading: loadingPayments } = useMyPayments();

  const today = new Date();
  const nextPending = payments.find((p) => p.status === "pending");
  const isOverdue =
    nextPending != null && new Date(nextPending.due_date) < today;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Greeting */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {loadingContact ? (
          <div className="h-7 w-48 animate-pulse rounded bg-mist" />
        ) : (
          <h2 className="text-xl font-bold text-navy">
            Bienvenido{contact?.name ? `, ${contact.name}` : ""}
          </h2>
        )}
        <p className="mt-1 text-sm text-slate2">
          Este es tu espacio como inquilino. Revisá tu contrato, tus pagos y enviá reclamos.
        </p>
      </div>

      {/* Contract status */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate2">
          Contrato activo
        </p>
        {loadingContract ? (
          <div className="h-5 w-56 animate-pulse rounded bg-mist" />
        ) : contract ? (
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-medium text-foreground">
              {contract.property?.address ?? "Sin dirección"}
            </p>
            <ContractStatusBadge status={contract.status} />
          </div>
        ) : (
          <p className="text-sm text-slate2">No se encontró un contrato activo.</p>
        )}
      </div>

      {/* Next payment */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate2">
          Próximo vencimiento
        </p>
        {loadingPayments ? (
          <div className="h-5 w-40 animate-pulse rounded bg-mist" />
        ) : nextPending ? (
          <div className="flex items-center gap-3">
            {isOverdue && (
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
            )}
            <div>
              <p
                className={cn(
                  "text-sm font-semibold",
                  isOverdue ? "text-red-600" : "text-foreground",
                )}
              >
                {new Date(nextPending.due_date).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="text-xs text-slate2">
                {isOverdue ? "Pago vencido" : "Pago pendiente"} ·{" "}
                {nextPending.currency}{" "}
                {nextPending.amount.toLocaleString("es-AR")}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate2">No hay pagos pendientes.</p>
        )}
      </div>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink
          to="/tenant/contrato"
          icon={FileText}
          label="Mi Contrato"
          description="Ver detalle del contrato"
        />
        <QuickLink
          to="/tenant/pagos"
          icon={CreditCard}
          label="Mis Pagos"
          description="Historial de cuotas"
        />
        <QuickLink
          to="/tenant/reclamos"
          icon={MessageSquare}
          label="Mis Reclamos"
          description="Enviar o seguir reclamos"
        />
      </div>
    </div>
  );
}
