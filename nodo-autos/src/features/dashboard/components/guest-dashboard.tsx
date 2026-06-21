import { Car } from "lucide-react";
import { useAuth } from "@nodocore/shared-components";

/**
 * GuestDashboard — shown when the authenticated user has role = "guest".
 * Displays a welcome/placeholder screen while admin access is being configured.
 */
export function GuestDashboard() {
  const { user } = useAuth();
  const name =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "Invitado";

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
        <Car className="h-8 w-8 text-brand" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-navy">Bienvenido, {name}</h2>
        <p className="max-w-sm text-slate2">
          Tu acceso está siendo configurado. Pronto tendrás disponibles todas
          las funciones del panel.
        </p>
      </div>

      <p className="text-xs text-slate2-300">
        Contactá al administrador si necesitás acceso inmediato.
      </p>
    </div>
  );
}
