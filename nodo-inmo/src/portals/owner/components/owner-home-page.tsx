import { Link } from "react-router-dom";
import { Home, HandCoins, Building2 } from "lucide-react";
import { useMyOwnerContact } from "../hooks/use-my-owner-contact";
import { useMyProperties } from "../hooks/use-my-properties";
import { useMySettlements } from "../hooks/use-my-settlements";
import { cn } from "@/shared/lib/utils";

function SummaryCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate2">{label}</p>
        <Icon className="h-5 w-5 text-brand" />
      </div>
      <p className="mt-2 text-3xl font-bold text-navy">{value}</p>
    </div>
  );
}

export function OwnerHomePage() {
  const { data: contact, isLoading: contactLoading } = useMyOwnerContact();
  const { data: properties = [], isLoading: propertiesLoading } = useMyProperties();
  const { data: settlements = [], isLoading: settlementsLoading } = useMySettlements();

  const isLoading = contactLoading || propertiesLoading || settlementsLoading;

  const currentYear = new Date().getFullYear();

  const pendingCount = settlements.filter((s) => s.status === "pending").length;
  const settledThisYear = settlements
    .filter(
      (s) =>
        s.status === "settled" &&
        s.settled_date &&
        new Date(s.settled_date).getFullYear() === currentYear,
    )
    .reduce((sum, s) => sum + s.amount, 0);

  const greeting = contact?.name ? `Bienvenido, ${contact.name.split(" ")[0]}` : "Bienvenido";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate2">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold text-navy">{greeting}</h2>
        <p className="mt-1 text-sm text-slate2">
          Aquí podés ver el estado de tus propiedades y rendiciones.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Propiedades"
          value={properties.length}
          icon={Building2}
        />
        <SummaryCard
          label="Rendiciones pendientes"
          value={pendingCount}
          icon={HandCoins}
        />
        <SummaryCard
          label={`Acreditado ${currentYear}`}
          value={
            settledThisYear > 0
              ? new Intl.NumberFormat("es-AR", {
                  style: "currency",
                  currency: "ARS",
                  minimumFractionDigits: 0,
                }).format(settledThisYear)
              : "$0"
          }
          icon={HandCoins}
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/owner/propiedades"
          className="flex items-center gap-4 rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:border-brand hover:bg-brand/5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand/10">
            <Home className="h-5 w-5 text-brand" />
          </div>
          <div>
            <p className="font-semibold text-navy">Mis Propiedades</p>
            <p className="text-sm text-slate2">Ver el listado de tus propiedades</p>
          </div>
        </Link>

        <Link
          to="/owner/rendiciones"
          className="flex items-center gap-4 rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:border-brand hover:bg-brand/5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand/10">
            <HandCoins className="h-5 w-5 text-brand" />
          </div>
          <div>
            <p className="font-semibold text-navy">Mis Rendiciones</p>
            <p className="text-sm text-slate2">Historial de liquidaciones</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
