import { User } from "lucide-react";
import { useAuth } from "@nodocore/shared-components";
import { useMyProfile } from "@/features/customer-portal/hooks/use-my-orders";

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(
    new Date(d),
  );
}

export function MyProfilePage() {
  const { user } = useAuth();
  const { data: customer, isLoading } = useMyProfile();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-navy">Mis datos</h1>

      {isLoading && <div className="h-48 rounded-xl bg-muted animate-pulse" />}

      {!isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Account info */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-brand/10">
                <User className="h-5 w-5 text-brand" />
              </div>
              <h2 className="font-semibold text-foreground">Cuenta</h2>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-24 shrink-0">Email</dt>
                <dd className="font-medium text-foreground">{user?.email ?? "—"}</dd>
              </div>
              {customer && (
                <>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-24 shrink-0">Nombre</dt>
                    <dd className="font-medium text-foreground">
                      {customer.first_name} {customer.last_name}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-24 shrink-0">Teléfono</dt>
                    <dd className="font-medium text-foreground">
                      {customer.phone ?? "—"}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {/* Purchase summary */}
          {customer && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold text-foreground mb-4">
                Historial de compras
              </h2>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-32 shrink-0">
                    Total gastado
                  </dt>
                  <dd className="font-bold text-foreground text-base">
                    {formatPrice(customer.total_spent)}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground w-32 shrink-0">
                    Última compra
                  </dt>
                  <dd className="font-medium text-foreground">
                    {customer.last_purchase_at
                      ? formatDate(customer.last_purchase_at)
                      : "—"}
                  </dd>
                </div>
                {customer.city && (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground w-32 shrink-0">
                      Ciudad
                    </dt>
                    <dd className="font-medium text-foreground">
                      {customer.city}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {!customer && (
            <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-center text-sm text-muted-foreground">
              No encontramos un perfil de cliente asociado a tu cuenta.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
