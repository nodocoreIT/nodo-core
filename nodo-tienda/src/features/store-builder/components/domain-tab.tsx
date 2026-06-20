import { useState } from "react";
import { CheckCircle2, Clock, Globe, AlertTriangle } from "lucide-react";
import { Button, Input } from "@nodocore/shared-components";
import {
  useStore,
  useSetCustomDomain,
} from "@/features/store-builder/hooks/use-store";

export function DomainTab() {
  const { data: store, isLoading } = useStore();
  const setDomain = useSetCustomDomain();
  const [domainInput, setDomainInput] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  if (!store) {
    return (
      <p className="text-sm text-muted-foreground">
        No se encontró la tienda. Configurá tu perfil primero.
      </p>
    );
  }

  const isVerified = !!store.domain_verified_at;
  const hasDomain = !!store.custom_domain;

  async function handleSetDomain() {
    if (!store) return;
    const domain = domainInput.trim().replace(/^https?:\/\//, "");
    await setDomain.mutateAsync({ storeId: store.id, domain });
    setDomainInput("");
    setVerifyError(null);
  }

  async function handleVerify() {
    if (!store?.custom_domain || !store?.domain_verify_token) return;
    setVerifyError(null);
    try {
      const storeUrl =
        import.meta.env.VITE_STORE_URL ?? "http://localhost:3001";
      const res = await fetch(`${storeUrl}/api/domain-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: store.org_id,
          domain: store.custom_domain,
        }),
      });
      const json = await res.json();
      if (json.verified) {
        window.location.reload();
      } else {
        setVerifyError(
          "No se encontró el registro TXT aún. Aguardá unos minutos y volvé a intentar.",
        );
      }
    } catch {
      setVerifyError("Error al conectarse con el servidor. Intentá de nuevo.");
    }
  }

  return (
    <div className="max-w-lg space-y-8">
      {/* Default domain */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Dominio por defecto
            </p>
            <p className="text-sm text-muted-foreground font-mono">
              {store.slug}.nodostore.com
            </p>
          </div>
        </div>
      </div>

      {/* Custom domain status */}
      {hasDomain && (
        <div
          className={`rounded-xl border p-5 ${
            isVerified
              ? "border-green-200 bg-green-50"
              : "border-orange-200 bg-orange-50"
          }`}
        >
          <div className="flex items-center gap-3">
            {isVerified ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            ) : (
              <Clock className="h-5 w-5 text-orange-600 shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">
                {isVerified ? "Dominio verificado" : "Pendiente de verificación"}
              </p>
              <p className="text-sm font-mono text-muted-foreground">
                {store.custom_domain}
              </p>
            </div>
            {!isVerified && (
              <Button size="sm" variant="outline" onClick={handleVerify}>
                Verificar ahora
              </Button>
            )}
          </div>
          {verifyError && (
            <p className="mt-3 text-xs text-orange-700">{verifyError}</p>
          )}
        </div>
      )}

      {/* DNS instructions */}
      {hasDomain && !isVerified && store.domain_verify_token && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
            <h3 className="font-semibold text-sm">
              Instrucciones de verificación
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Agregá el siguiente registro TXT en el proveedor de DNS de tu
            dominio:
          </p>
          <div className="rounded-lg bg-slate-900 p-4 font-mono text-xs text-slate-200 space-y-2">
            <div>
              <span className="text-slate-400">Tipo: </span>TXT
            </div>
            <div>
              <span className="text-slate-400">Host: </span>@
            </div>
            <div>
              <span className="text-slate-400">Valor: </span>
              nodo-verify={store.domain_verify_token}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Los cambios de DNS pueden demorar hasta 48hs en propagarse.
          </p>
        </div>
      )}

      {/* Set new domain */}
      <div className="space-y-3">
        <h3 className="font-semibold text-navy">
          {hasDomain ? "Cambiar dominio" : "Conectar dominio propio"}
        </h3>
        <p className="text-sm text-muted-foreground">
          Ingresá tu dominio (ej:{" "}
          <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
            www.mitienda.com
          </code>
          ). Luego configurá el registro DNS según las instrucciones.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="www.mitienda.com"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={handleSetDomain}
            disabled={!domainInput.trim() || setDomain.isPending}
          >
            {setDomain.isPending
              ? "Guardando..."
              : hasDomain
                ? "Cambiar"
                : "Conectar"}
          </Button>
        </div>
        {hasDomain && (
          <button
            className="text-xs text-red-500 hover:underline"
            onClick={() =>
              setDomain.mutate({ storeId: store.id, domain: "" })
            }
            disabled={setDomain.isPending}
          >
            Quitar dominio personalizado
          </button>
        )}
      </div>
    </div>
  );
}
