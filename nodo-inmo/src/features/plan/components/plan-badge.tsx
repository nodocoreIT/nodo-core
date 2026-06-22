import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Copy, Crown, KeyRound, Lock, ArrowRight } from "lucide-react";
import { useAuth } from "@nodocore/shared-components";
import { cn } from "@/shared/lib/utils";
import { PRO_PLAN_BENEFITS, PRO_QUICK_LINKS } from "@/shared/lib/pro-features";
import { useNodoId } from "../hooks/use-nodo-id";

const POPOVER_MAX_HEIGHT = 280;
const POPOVER_WIDTH = 288;

function formatNodoId(value: string): string {
  return value.toUpperCase();
}

export interface PlanBadgeProps {
  /** Sidebar footer on mobile uses dark styling and full width. */
  variant?: "default" | "sidebar";
  className?: string;
}

type PopoverPlacement = "above" | "below";

interface PopoverPosition {
  left: number;
  width: number;
  placement: PopoverPlacement;
  top?: number;
  bottom?: number;
}

export function PlanBadge({ variant = "default", className }: PlanBadgeProps) {
  const { plan } = useAuth();
  const isPro = plan === "pro";
  const { data: nodoId, isLoading, isError, refetch, isFetching } = useNodoId();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<PopoverPosition>({
    left: 16,
    width: POPOVER_WIDTH,
    placement: "below",
    top: 0,
  });

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    function updatePosition() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const width = Math.min(POPOVER_WIDTH, window.innerWidth - 24);
      let left = rect.left + (rect.width - width) / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12));

      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const openAbove =
        spaceBelow < POPOVER_MAX_HEIGHT && spaceAbove > spaceBelow;

      if (openAbove) {
        setPopoverPos({
          left,
          width,
          placement: "above",
          bottom: window.innerHeight - rect.top + 8,
        });
      } else {
        setPopoverPos({
          left,
          width,
          placement: "below",
          top: rect.bottom + 8,
        });
      }
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

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
    <div className={cn("relative shrink-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={cn(
          "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm transition-colors",
          variant === "sidebar" && "w-full justify-center",
          isPro
            ? "border-orange-300/60 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700"
            : variant === "sidebar"
              ? "border-white/20 bg-white/5 text-white hover:border-white/30 hover:bg-white/10"
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

      {isOpen
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={isPro ? "Plan Pro" : "Plan Starter"}
              className={cn(
                "overflow-y-auto rounded-lg border border-border bg-white p-3 shadow-xl ring-1 ring-black/5",
                popoverPos.placement === "above" ? "origin-bottom" : "origin-top",
              )}
              style={{
                position: "fixed",
                left: popoverPos.left,
                width: popoverPos.width,
                maxHeight: POPOVER_MAX_HEIGHT,
                top: popoverPos.top,
                bottom: popoverPos.bottom,
                zIndex: 9999,
              }}
            >
              <PlanPanel
                isPro={isPro}
                nodoId={nodoId?.id}
                isLoading={isLoading}
                isError={isError}
                isFetching={isFetching}
                copied={copied}
                onClose={() => setIsOpen(false)}
                onCopyKey={handleCopyKey}
                onRefetch={() => void refetch()}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

interface PlanPanelProps {
  isPro: boolean;
  nodoId?: string;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  copied: boolean;
  onClose: () => void;
  onCopyKey: () => void;
  onRefetch: () => void;
}

function PlanPanel({
  isPro,
  nodoId,
  isLoading,
  isError,
  isFetching,
  copied,
  onClose,
  onCopyKey,
  onRefetch,
}: PlanPanelProps) {
  if (isPro) {
    return (
      <div className="space-y-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600">
            Plan Pro activo
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate2">
            Portales, reclamos y ecosistema Nodo habilitados.
          </p>
        </div>

        <div className="rounded-md border border-orange-100 bg-orange-50/80 p-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-navy">
            <KeyRound className="h-3 w-3 text-orange-600" aria-hidden />
            Nodo ID
          </div>
          {isLoading ? (
            <p className="text-[10px] text-slate2">Cargando…</p>
          ) : isError ? (
            <button
              type="button"
              onClick={onRefetch}
              disabled={isFetching}
              className="text-[10px] font-semibold text-orange-600 hover:underline disabled:opacity-50"
            >
              {isFetching ? "Reintentando…" : "Reintentar"}
            </button>
          ) : nodoId ? (
            <>
              <code className="block break-all rounded bg-white px-1.5 py-1 text-[10px] font-mono text-navy ring-1 ring-orange-100">
                {formatNodoId(nodoId)}
              </code>
              <button
                type="button"
                onClick={onCopyKey}
                className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded bg-orange-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-orange-700"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" aria-hidden />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" aria-hidden />
                    Copiar
                  </>
                )}
              </button>
            </>
          ) : (
            <p className="text-[10px] text-slate2">Contactá soporte NodoCore.</p>
          )}
        </div>

        <div className="space-y-0.5">
          {PRO_QUICK_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-[10px] font-medium text-navy hover:bg-orange-50"
            >
              {label}
              <ArrowRight className="h-3 w-3 shrink-0 text-orange-500" aria-hidden />
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate2">Plan Starter</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate2">
          Propiedades, contratos, pagos y caja. Lo avanzado queda en Pro.
        </p>
      </div>

      <ul className="space-y-1 border-t border-border pt-2">
        {PRO_PLAN_BENEFITS.map((benefit) => (
          <li key={benefit} className="flex items-start gap-1.5 text-[10px] leading-snug text-slate2">
            <Lock className="mt-0.5 h-2.5 w-2.5 shrink-0 opacity-40" aria-hidden />
            {benefit}
          </li>
        ))}
      </ul>

      <p className="border-t border-border pt-2 text-[10px] leading-snug text-slate2/80">
        Escribinos a NodoCore para pasar a Pro.
      </p>
    </div>
  );
}
