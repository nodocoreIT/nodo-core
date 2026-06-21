import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Copy, Crown, KeyRound, Lock, ArrowRight } from "lucide-react";
import { useAuth } from "@nodocore/shared-components";
import { cn } from "@/shared/lib/utils";
import { PRO_PLAN_BENEFITS, PRO_QUICK_LINKS } from "@/shared/lib/pro-features";
import { useNodoId } from "../hooks/use-nodo-id";
function formatNodoId(value: string): string {
  return value.toUpperCase();
}

export function PlanBadge() {
  const { plan } = useAuth();
  const isPro = plan === "pro";
  const { data: nodoId, isLoading, isError, refetch, isFetching } = useNodoId();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) setCopied(false);
  }, [isOpen]);

  async function handleCopyKey() {
    if (!nodoId?.id) return;
    try {
      await navigator.clipboard.writeText(nodoId.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copiá tu Nodo ID:", nodoId.id);
    }
  }

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={cn(
          "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm transition-colors",
          isPro
            ? "border-orange-300/60 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700"
            : "border-border bg-card text-slate2 hover:border-brand/40 hover:text-navy",
        )}
      >
        {isPro ? (
          <Crown className="h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <Lock className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
        )}
        <span>{isPro ? "Pro" : "Starter"}</span>
        <ChevronDown
          className={cn("h-3 w-3 shrink-0 opacity-80 transition-transform", isOpen && "rotate-180")}
          aria-hidden
        />
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-label={isPro ? "Plan Pro" : "Plan Starter"}
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-border bg-white p-4 shadow-lg"
        >
          {isPro ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                  Plan Pro activo
                </p>
                <p className="mt-1 text-sm text-slate2">
                  Tu inmobiliaria tiene acceso a portales, reclamos y el ecosistema Nodo.
                </p>
              </div>

              <div className="rounded-lg border border-orange-100 bg-orange-50/80 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-navy">
                  <KeyRound className="h-3.5 w-3.5 text-orange-600" aria-hidden />
                  Tu Nodo ID
                </div>
                {isLoading ? (
                  <p className="text-xs text-slate2">Cargando llave…</p>
                ) : isError ? (
                  <div className="space-y-2">
                    <p className="text-xs text-red-600">
                      No se pudo cargar el Nodo ID. Reintentá en unos segundos.
                    </p>
                    <button
                      type="button"
                      onClick={() => void refetch()}
                      disabled={isFetching}
                      className="text-xs font-semibold text-orange-600 hover:underline disabled:opacity-50"
                    >
                      {isFetching ? "Reintentando…" : "Reintentar"}
                    </button>
                  </div>
                ) : nodoId?.id ? (
                  <>
                    <code className="block break-all rounded-md bg-white px-2 py-1.5 text-[11px] font-mono text-navy ring-1 ring-orange-100">
                      {formatNodoId(nodoId.id)}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                          Copiar llave
                        </>
                      )}
                    </button>
                    <p className="mt-2 text-[11px] leading-snug text-slate2">
                      Compartí esta llave con otros usuarios Pro para conectar nodos del ecosistema.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate2">
                    Tu Nodo ID se generará al activar Plan Pro en tu organización. Si ya sos Pro,
                    contactá a soporte NodoCore.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate2">
                  Accesos Pro
                </p>
                {PRO_QUICK_LINKS.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-navy hover:bg-orange-50"
                  >
                    {label}
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-orange-500" aria-hidden />
                  </Link>
                ))}
              </div>

              <ul className="space-y-1.5">                {PRO_PLAN_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 text-xs text-slate2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" aria-hidden />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate2">
                  Plan Starter
                </p>
                <p className="mt-1 text-sm text-slate2">
                  Gestioná propiedades, contratos, pagos y caja. Algunas funciones avanzadas están
                  reservadas para Pro.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-slate-50 p-3">
                <p className="text-xs font-semibold text-navy">Incluido en Plan Pro</p>
                <ul className="mt-2 space-y-1.5">
                  {PRO_PLAN_BENEFITS.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2 text-xs text-slate2">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0 opacity-50" aria-hidden />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-[11px] leading-snug text-slate2">
                Contactá a NodoCore para actualizar tu plan y obtener tu Nodo ID.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
