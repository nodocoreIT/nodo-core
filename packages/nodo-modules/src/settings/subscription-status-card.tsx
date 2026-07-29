import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@nodocore/shared-components";

const ESTADO_LABELS: Record<string, { label: string; className: string }> = {
  activo: { label: "Al día", className: "bg-mist text-brand" },
  impago: { label: "Pago pendiente", className: "bg-orange-100 text-orange-700" },
  pausado: { label: "Pausado", className: "bg-mist/30 text-slate2" },
  sin_acceso: { label: "Sin acceso", className: "bg-mist/30 text-slate2" },
};

function formatMonto(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("es-AR").format(amount);
  const symbol = currency === "USD" ? "US$" : "$";
  return `${symbol} ${formatted}`;
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export interface SubscriptionStatusInfo {
  planLabel: string;
  billingAmount: number;
  billingCurrency: string;
  nextDueAt: string;
  clientUnitStatus: string;
}

export interface SubscriptionStatusCardProps {
  subscription: SubscriptionStatusInfo | null;
  isLoading: boolean;
  /** e.g. "NODO Inmo", "NODO Autos" */
  nodeLabel: string;
  /** Custom copy for the impago warning banner (defaults to a generic message). */
  impagoWarning?: string;
}

export function SubscriptionStatusCard({
  subscription,
  isLoading,
  nodeLabel,
  impagoWarning,
}: SubscriptionStatusCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 animate-pulse">
          <div className="h-4 w-32 bg-mist rounded-md mb-3" />
          <div className="h-6 w-48 bg-mist rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-slate2">
            Todavía no hay una suscripción de plataforma configurada para esta cuenta.
          </p>
        </CardContent>
      </Card>
    );
  }

  const estado = ESTADO_LABELS[subscription.clientUnitStatus] ?? {
    label: subscription.clientUnitStatus,
    className: "bg-mist/30 text-slate2",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{subscription.planLabel}</CardTitle>
          <p className="text-sm text-slate2">Suscripción a {nodeLabel}</p>
        </div>
        <span
          className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${estado.className}`}
        >
          {estado.label}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate2 uppercase tracking-wider mb-1">Monto</p>
            <p className="text-base font-bold text-navy">
              {formatMonto(subscription.billingAmount, subscription.billingCurrency)}
              <span className="text-xs font-normal text-slate2"> /mes</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate2 uppercase tracking-wider mb-1">Próximo cobro</p>
            <p className="text-base font-bold text-navy">{formatFecha(subscription.nextDueAt)}</p>
          </div>
        </div>

        {subscription.clientUnitStatus === "impago" && (
          <p className="text-sm text-orange-700 bg-orange-50 rounded-lg px-4 py-3 flex items-start gap-2">
            <Lock className="h-4 w-4 flex-shrink-0 mt-0.5" />
            {impagoWarning ??
              "No pudimos procesar el último cobro. Mientras el pago esté pendiente, el acceso para todos los usuarios de esta cuenta queda limitado."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
