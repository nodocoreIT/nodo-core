"use client";

import { Lock } from "lucide-react";
import { useBillingSubscription } from "@/hooks/use-billing-subscription";

const ESTADO_LABELS: Record<string, { label: string; className: string }> = {
  activo: { label: "Al día", className: "bg-gold/10 text-gold" },
  impago: { label: "Pago pendiente", className: "bg-orange-500/10 text-orange-400" },
  pausado: { label: "Pausado", className: "bg-white/5 text-luxury-gray-light" },
  sin_acceso: { label: "Sin acceso", className: "bg-white/5 text-luxury-gray-light" },
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

export default function SuscripcionClient() {
  const { subscription, isLoading } = useBillingSubscription();

  return (
    <>
      <div className="mb-8">
        <p className="text-gold text-xs tracking-[0.3em] uppercase mb-1">Dashboard</p>
        <h1 className="text-white text-2xl font-serif">Suscripción</h1>
        <p className="text-[#555555] text-sm mt-1">
          Estado de tu suscripción a NODO Ecommerce.
        </p>
      </div>

      {isLoading ? (
        <div className="bg-luxury-black border border-luxury-gray p-6 max-w-2xl animate-pulse">
          <div className="h-4 w-32 bg-luxury-gray-mid mb-3" />
          <div className="h-6 w-48 bg-luxury-gray-mid" />
        </div>
      ) : !subscription ? (
        <div className="bg-luxury-black border border-luxury-gray p-6 max-w-2xl text-center">
          <p className="text-[#555555] text-sm">
            Todavía no hay una suscripción de plataforma configurada para esta cuenta.
          </p>
        </div>
      ) : (
        <div className="bg-luxury-black border border-luxury-gray p-6 max-w-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white text-lg font-semibold">{subscription.planLabel}</h2>
              <p className="text-luxury-gray-light text-xs mt-0.5">Suscripción a NODO Ecommerce</p>
            </div>
            {(() => {
              const estado = ESTADO_LABELS[subscription.clientUnitStatus] ?? {
                label: subscription.clientUnitStatus,
                className: "bg-white/5 text-luxury-gray-light",
              };
              return (
                <span
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${estado.className}`}
                >
                  {estado.label}
                </span>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[#555555] text-[10px] uppercase tracking-wider mb-1">Monto</p>
              <p className="text-white text-base font-semibold">
                {formatMonto(subscription.billingAmount, subscription.billingCurrency)}
                <span className="text-luxury-gray-light text-xs font-normal"> /mes</span>
              </p>
            </div>
            <div>
              <p className="text-[#555555] text-[10px] uppercase tracking-wider mb-1">Próximo cobro</p>
              <p className="text-white text-base font-semibold">{formatFecha(subscription.nextDueAt)}</p>
            </div>
          </div>

          {subscription.clientUnitStatus === "impago" && (
            <p className="text-orange-400 text-sm bg-orange-500/5 border border-orange-500/20 px-4 py-3 flex items-start gap-2">
              <Lock className="h-4 w-4 flex-shrink-0 mt-0.5" />
              No pudimos procesar el último cobro. Mientras el pago esté pendiente, el acceso al
              panel queda limitado.
            </p>
          )}
        </div>
      )}
    </>
  );
}
