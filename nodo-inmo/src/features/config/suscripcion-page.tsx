import { DollarSign, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@nodocore/shared-components";
import { useBillingSubscription } from "@/shared/hooks/use-billing-subscription";

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

export function SuscripcionPage() {
  const { subscription, isLoading } = useBillingSubscription();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <DollarSign className="w-8 h-8 text-brand" />
        <div>
          <h2 className="text-3xl font-bold text-navy">Suscripción</h2>
          <p className="text-slate2">Estado de tu suscripción a NODO Inmo</p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 animate-pulse">
            <div className="h-4 w-32 bg-mist rounded-md mb-3" />
            <div className="h-6 w-48 bg-mist rounded-md" />
          </CardContent>
        </Card>
      ) : !subscription ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-slate2">
              Todavía no hay una suscripción de plataforma configurada para esta cuenta.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{subscription.planLabel}</CardTitle>
              <p className="text-sm text-slate2">Suscripción a NODO Inmo</p>
            </div>
            {(() => {
              const estado = ESTADO_LABELS[subscription.clientUnitStatus] ?? {
                label: subscription.clientUnitStatus,
                className: "bg-mist/30 text-slate2",
              };
              return (
                <span
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider ${estado.className}`}
                >
                  {estado.label}
                </span>
              );
            })()}
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
                No pudimos procesar el último cobro. Mientras el pago esté pendiente, el acceso
                para todos los usuarios de esta inmobiliaria (staff, propietarios e inquilinos)
                queda limitado.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
