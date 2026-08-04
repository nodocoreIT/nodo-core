"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useAuth, useBillingLockout } from "@nodocore/shared-components";

/**
 * NODO billing the clinic (unrelated to the doctor's own MercadoPago
 * subscription — lib/mercadopago/, professionals.subscription_status).
 * Distinct path/label from the existing "Suscripción" tab in
 * DoctorSettingsDialog on purpose, to avoid confusing the two systems.
 */
const SUBSCRIPTION_PATH = "/medico/suscripcion-plataforma";

/**
 * Only ever rendered when `AuthProvider` is actually mounted (platform mode)
 * — see medico-admin-layout.tsx's `isPlatformMode() && isBrowserSupabaseEnabled()`
 * guard around this component. Calling `useAuth()` outside that provider throws.
 */
export function BillingLockoutGate({ children }: { children: ReactNode }) {
  const { billingLocked, accessReason } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const billingGate = useBillingLockout({
    billingLocked,
    pathname: pathname ?? "",
    subscriptionPath: SUBSCRIPTION_PATH,
  });

  useEffect(() => {
    if (billingGate.shouldRedirect && billingGate.redirectTo) {
      router.replace(billingGate.redirectTo);
    }
  }, [billingGate.shouldRedirect, billingGate.redirectTo, router]);

  if (billingGate.shouldRedirect && !billingGate.redirectTo) {
    // Fail-safe: no Suscripción route configured — block rather than grant access.
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <Lock className="h-10 w-10 text-slate2" />
        <p className="text-sm text-slate2 max-w-sm">
          {accessReason === "trial_expired"
            ? "Tu período de prueba terminó. El nodo quedó pausado — suscribite para seguir usando Nodo Clínica."
            : "No pudimos procesar tu último pago. El nodo quedó pausado hasta que regularices la suscripción."}{" "}
          Contactate con NODO Core si el problema persiste.
        </p>
      </div>
    );
  }

  if (billingGate.shouldRedirect) return null;

  return <>{children}</>;
}

export { SUBSCRIPTION_PATH as PLATFORM_SUBSCRIPTION_PATH };
