"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ArrowLeftRight,
  Building2,
  Car,
  Coins,
  Stethoscope,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { useSupabase } from "@nodocore/shared-components";
import { useMyOrgs } from "./use-my-orgs";
import type { OrgEntry } from "./types";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  agent: "Empleado",
  seller: "Vendedor",
  guest: "Invitado",
  member: "Miembro",
  owner: "Propietario",
  tenant: "Inquilino",
  medico: "Médico",
  paciente: "Paciente",
};

const PRODUCT_META: Record<
  string,
  { label: string; color: string; lightBg: string; Icon: LucideIcon }
> = {
  inmo: { label: "Nodo Inmo", color: "#da5a0e", lightBg: "#FEF0E6", Icon: Building2 },
  autos: { label: "Nodo Autos", color: "#C41E3A", lightBg: "#FCE8EC", Icon: Car },
  finanzas: { label: "Nodo Finanzas", color: "#059669", lightBg: "#E7F7F0", Icon: Coins },
  clinica: { label: "Nodo Clínica", color: "#0D9488", lightBg: "#E6F7F5", Icon: Stethoscope },
};

function getProductIcon(product?: string): LucideIcon {
  return PRODUCT_META[product ?? ""]?.Icon ?? Building2;
}

const PRODUCT_PATHS: Record<string, string> = {
  inmo: "/inmo/admin/dashboard",
  autos: "/autos/admin/dashboard",
  finanzas: "/finanzas/admin/dashboard",
};

const PENDING_ORG_SWITCH_KEY = "nodo-org-switch-pending";

type PendingOrgSwitch = {
  targetOrgId: string;
  targetProduct: string;
  targetRole: string;
  targetName: string;
};

function readPendingOrgSwitch(): PendingOrgSwitch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_ORG_SWITCH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingOrgSwitch;
  } catch {
    return null;
  }
}

function markPendingOrgSwitch(org: OrgEntry, targetName: string) {
  try {
    const payload: PendingOrgSwitch = {
      targetOrgId: org.org_id,
      targetProduct: org.product,
      targetRole: org.role,
      targetName,
    };
    sessionStorage.setItem(PENDING_ORG_SWITCH_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function clearPendingOrgSwitch() {
  try {
    sessionStorage.removeItem(PENDING_ORG_SWITCH_KEY);
  } catch {
    // ignore
  }
}

function isOrgSwitchComplete(
  pending: PendingOrgSwitch,
  product: string | undefined,
  clinicaRole: string | undefined,
  currentOrgId: string | null,
): boolean {
  if (pending.targetProduct === "clinica") {
    return product === "clinica" && pending.targetRole === clinicaRole;
  }
  return product === pending.targetProduct && currentOrgId === pending.targetOrgId;
}

/**
 * Inmo/Autos/Finanzas/Ecommerce are Next.js Multi-Zone apps under the same
 * origin as nodo-landing — same Supabase session in localStorage, so
 * switching between them is a plain same-origin navigation. Clinica is a
 * genuinely separate deployment/domain, so switching to/from it needs the
 * same access_token/refresh_token hash relay the login flow already uses
 * (see nodo-landing/app/[nodeSlug]/login/page.tsx `redirectAfterSession` and
 * each nodo's own /auth/callback route).
 */
const LANDING_ORIGIN = "https://www.nodocore.com.ar";
const CLINICA_ORIGIN = "https://clinica.nodocore.com.ar";

function crossOriginCallbackUrl(targetProduct: string, accessToken: string, refreshToken: string): string {
  const base =
    targetProduct === "clinica" ? `${CLINICA_ORIGIN}/auth/callback` : `${LANDING_ORIGIN}/${targetProduct}/auth/callback`;
  return `${base}#access_token=${accessToken}&refresh_token=${refreshToken}`;
}

interface NodoSwitcherProps {
  /** Current product (e.g. "inmo", "clinica"). Same-product orgs shown first, others grouped below. */
  product?: string;
  /**
   * Current Clinica portal role ("medico" | "paciente"), when `product === "clinica"`.
   * Lets the switcher mark the active Clinica entry and offer the other role.
   */
  clinicaRole?: "medico" | "paciente";
}

function orgEntryKey(org: OrgEntry): string {
  return `${org.product}::${org.org_id}::${org.role}`;
}

/** Razón social / nombre de la org — no el nombre comercial del nodo. */
function displayOrgName(org: OrgEntry | undefined): string {
  if (!org) return "Organización";
  const name = org.org_name?.trim();
  if (name) return name;
  return PRODUCT_META[org.product]?.label ?? "Organización";
}

function productMeta(product?: string) {
  return PRODUCT_META[product ?? ""] ?? {
    label: "Nodo",
    color: "var(--color-navy, #121e2f)",
    lightBg: "var(--color-paper, #f8fafc)",
    Icon: Building2,
  };
}

export function NodoSwitcher({ product, clinicaRole }: NodoSwitcherProps = {}) {
  const supabase = useSupabase();
  const { orgs: allOrgs, loading } = useMyOrgs();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(() => readPendingOrgSwitch() != null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(
    () => readPendingOrgSwitch()?.targetName ?? null,
  );
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [hoveredEntryKey, setHoveredEntryKey] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  // Detect current org from JWT claims.
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const meta = data.session?.user?.app_metadata as
        | Record<string, string>
        | undefined;
      setCurrentOrgId(meta?.org_id ?? null);
      setSessionChecked(true);
    });
  }, [supabase]);

  // Tras navegar entre nodos/orgs, el loader persiste hasta confirmar destino.
  useEffect(() => {
    if (!sessionChecked || loading) return;
    const pending = readPendingOrgSwitch();
    if (!pending) return;

    if (isOrgSwitchComplete(pending, product, clinicaRole, currentOrgId)) {
      clearPendingOrgSwitch();
      setSwitching(false);
      setSwitchingTo(null);
      return;
    }

    setSwitching(true);
    setSwitchingTo(pending.targetName);
  }, [sessionChecked, loading, product, clinicaRole, currentOrgId]);

  function finishSwitchWithError(message: string) {
    clearPendingOrgSwitch();
    setSwitchError(message);
    setSwitching(false);
    setSwitchingTo(null);
  }

  // Close dropdown when clicking outside trigger or dropdown.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Compute dropdown position from the trigger button.
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
  }, [open]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Hide when user belongs to only one org (or still loading), salvo switch en curso.
  if ((loading || allOrgs.length <= 1) && !switching) return null;

  // Split orgs: current product first, then other products.
  const sameProduct = allOrgs
    .filter((o) => !product || o.product === product)
    .sort((a, b) => {
      const aOwn = a.role === "super_admin" ? 0 : 1;
      const bOwn = b.role === "super_admin" ? 0 : 1;
      return aOwn - bOwn;
    });

  const otherProducts = allOrgs.filter((o) => product && o.product !== product);

  // Group other-product orgs by product.
  const otherByProduct: Record<string, OrgEntry[]> = {};
  for (const org of otherProducts) {
    if (!otherByProduct[org.product]) otherByProduct[org.product] = [];
    otherByProduct[org.product].push(org);
  }
  // Sort each group: super_admin first.
  for (const key of Object.keys(otherByProduct)) {
    otherByProduct[key].sort((a, b) => {
      const aOwn = a.role === "super_admin" ? 0 : 1;
      const bOwn = b.role === "super_admin" ? 0 : 1;
      return aOwn - bOwn;
    });
  }

  const currentOrg =
    product === "clinica"
      ? (sameProduct.find((o) => o.role === clinicaRole) ?? sameProduct[0])
      : (sameProduct.find((o) => o.org_id === currentOrgId) ?? sameProduct[0]);

  function isEntryCurrent(org: OrgEntry): boolean {
    if (org.product === "clinica") {
      return product === "clinica" && org.role === clinicaRole;
    }
    // app_metadata.org_id is a single global field shared across every
    // nodo on this auth.users row — it can equal a DIFFERENT product's
    // org_id than the one currently on screen (e.g. its last-set value was
    // Inmo's org while actually viewing Clínica/Autos). Without also
    // checking product, that stale match made the entry look "already
    // selected", so clicking it silently no-op'd via the early return
    // above instead of switching.
    return product === org.product && org.org_id === currentOrgId;
  }

  async function handleSwitch(org: OrgEntry) {
    if (isEntryCurrent(org) || switching) return;
    setOpen(false);
    markPendingOrgSwitch(org, displayOrgName(org));
    setSwitching(true);
    setSwitchingTo(displayOrgName(org));
    setSwitchError(null);

    const targetIsClinica = org.product === "clinica";
    const currentIsClinica = product === "clinica";

    // Same product (Clinica), switching medico <-> paciente: same origin,
    // just flips the ClinicSession role via nodo-clinica's own endpoint.
    if (targetIsClinica && currentIsClinica) {
      try {
        const res = await fetch("/api/clinic/auth/set-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ role: org.role === "medico" ? "doctor" : "patient" }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          finishSwitchWithError(body.error ?? "No se pudo cambiar de rol");
          return;
        }
        window.location.href = org.role === "medico" ? "/medico/dashboard" : "/paciente";
      } catch (err) {
        finishSwitchWithError(err instanceof Error ? err.message : "No se pudo cambiar de rol");
      }
      return;
    }

    // Genuinely cross-origin (Clinica <-> any other nodo): relay the current
    // session's tokens to the target's own /auth/callback, same mechanism
    // the login flow already uses — no switch-org edge function involved,
    // since that function only knows about shared.organizations.
    if (targetIsClinica || currentIsClinica) {
      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        const refreshToken = data.session?.refresh_token;
        if (!accessToken || !refreshToken) {
          finishSwitchWithError("No se pudo resolver la sesión actual.");
          return;
        }
        window.location.href = crossOriginCallbackUrl(org.product, accessToken, refreshToken);
      } catch (err) {
        finishSwitchWithError(err instanceof Error ? err.message : "No se pudo cambiar de nodo");
      }
      return;
    }

    const isCrossNodo = product && org.product !== product;

    try {
      const { error } = await supabase.functions.invoke("switch-org", {
        body: { org_id: org.org_id },
      });

      if (error) {
        let detail = error.message;
        try {
          const body = await (
            error as { context?: { json?: () => Promise<{ error?: string }> } }
          ).context?.json?.();
          if (body?.error) detail = body.error;
        } catch {
          // ignore
        }
        finishSwitchWithError(detail);
        return;
      }

      // Refresh session so the JWT reflects the new org.
      const { data: refreshed } = await supabase.auth.refreshSession();
      let newOrgId = refreshed?.session?.user?.app_metadata?.org_id as string | undefined;
      if (newOrgId !== org.org_id) {
        await new Promise((r) => setTimeout(r, 500));
        const { data: retryRefreshed } = await supabase.auth.refreshSession();
        newOrgId = retryRefreshed?.session?.user?.app_metadata?.org_id as string | undefined;
      }

      if (newOrgId !== org.org_id) {
        finishSwitchWithError("No se pudo confirmar el cambio de organización.");
        return;
      }

      if (isCrossNodo) {
        try {
          sessionStorage.setItem(`nodo-${org.product}-skip-splash`, "1");
        } catch {
          // ignore
        }
        const relayAccessToken = refreshed?.session?.access_token;
        const relayRefreshToken = refreshed?.session?.refresh_token;
        if (relayAccessToken && relayRefreshToken) {
          window.location.href = crossOriginCallbackUrl(org.product, relayAccessToken, relayRefreshToken);
        } else {
          const targetPath = PRODUCT_PATHS[org.product] ?? `/${org.product}/admin/dashboard`;
          window.location.href = targetPath;
        }
        return;
      }

      window.location.reload();
    } catch (err) {
      finishSwitchWithError(
        err instanceof Error ? err.message : "No se pudo cambiar de organización",
      );
    }
  }

  const switchOverlay = switching
    ? createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(6px)",
          }}
        >
          <Loader2
            size={36}
            style={{
              color: "var(--color-brand, #da5a0e)",
              animation: "spin 1s linear infinite",
            }}
          />
          <p
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--color-navy, #121e2f)",
              textAlign: "center",
              margin: 0,
            }}
          >
            Cambiando de organización
          </p>
          {switchingTo ? (
            <p
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "var(--color-brand, #da5a0e)",
                textAlign: "center",
                margin: 0,
                maxWidth: "min(90vw, 420px)",
              }}
            >
              {switchingTo}
            </p>
          ) : null}
        </div>,
        document.body,
      )
    : null;

  const CurrentProductIcon = getProductIcon(product);
  const currentMeta = productMeta(product);

  function renderOrgButton(org: OrgEntry, isCrossNodo = false) {
    const isCurrent = isEntryCurrent(org) && !isCrossNodo;
    const title = displayOrgName(org);
    const meta = productMeta(org.product);
    const entryKey = orgEntryKey(org);
    const isHovered = hoveredEntryKey === entryKey;
    const highlight = isCurrent || isHovered;
    return (
      <button
        key={entryKey}
        type="button"
        role="option"
        aria-selected={isCurrent}
        onClick={() => handleSwitch(org)}
        onMouseEnter={() => setHoveredEntryKey(entryKey)}
        onMouseLeave={() => setHoveredEntryKey((k) => (k === entryKey ? null : k))}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          textAlign: "left",
          border: "none",
          background: highlight ? meta.lightBg : "transparent",
          padding: "9px 10px",
          borderRadius: 6,
          cursor: isCurrent ? "default" : "pointer",
          gap: 8,
          transition: "background 0.12s ease",
        }}
      >
        <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
          <ArrowLeftRight size={14} color="var(--color-slate2)" style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              fontWeight: 700,
              color: "var(--color-navy)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 11.5,
              color: "var(--color-slate2)",
            }}
          >
            {ROLE_LABELS[org.role] ?? org.role}
          </p>
          </div>
        </div>
        {isCurrent && (
          <Check size={14} color={meta.color} style={{ flexShrink: 0 }} />
        )}
        {isCrossNodo && (
          <ExternalLink size={12} color="var(--color-slate2)" style={{ flexShrink: 0 }} />
        )}
      </button>
    );
  }

  const hasOtherProducts = Object.keys(otherByProduct).length > 0;

  return (
    <>
      {switchOverlay}
      <button
        ref={triggerRef}
        type="button"
        disabled={switching}
        onClick={() => {
          setSwitchError(null);
          setOpen((v) => !v);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "transparent",
          border: "1px solid var(--color-mist)",
          borderRadius: 8,
          padding: "6px 10px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-navy)",
          cursor: switching ? "not-allowed" : "pointer",
          opacity: switching ? 0.65 : 1,
          fontFamily: "var(--font-sans)",
          whiteSpace: "nowrap",
          maxWidth: 200,
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <CurrentProductIcon size={14} color={currentMeta.color} style={{ flexShrink: 0 }} />
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {switching
            ? "Cambiando..."
            : isMobile
              ? (displayOrgName(currentOrg).split(/\s+/)[0] ?? "Org")
              : displayOrgName(currentOrg)}
        </span>
        <ChevronDown
          size={13}
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          style={{
            position: "fixed",
            top: dropdownPos.top,
            // Right-anchored under the trigger on both mobile and desktop —
            // mobile previously stretched edge-to-edge (left:12, right:12),
            // reading as an oversized card instead of a compact dropdown.
            right: Math.max(12, dropdownPos.right),
            width: isMobile ? 300 : undefined,
            maxWidth: "calc(100vw - 24px)",
            minWidth: isMobile ? undefined : 260,
            maxHeight: 400,
            overflowY: "auto",
            background: "white",
            border: "1px solid var(--color-mist)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(18,30,47,.12)",
            zIndex: 9998,
            padding: 4,
          }}
        >
          {switchError && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "8px 10px",
                margin: "0 0 4px",
                background: "#FEF2F2",
                borderRadius: 6,
                fontSize: 12,
                color: "#991B1B",
                lineHeight: 1.4,
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {switchError}
            </div>
          )}

          {/* Same-product orgs */}
          {sameProduct.map((org) => renderOrgButton(org, false))}

          {/* Cross-nodo orgs grouped by product */}
          {hasOtherProducts && (
            <div
              style={{
                borderTop: "1px solid var(--color-mist, #e2e8f0)",
                margin: "4px 0 2px",
                paddingTop: 4,
              }}
            >
              {Object.entries(otherByProduct).map(([prod, prodOrgs]) => {
                const meta = productMeta(prod);
                return (
                  <div key={prod}>
                    <p
                      style={{
                        margin: 0,
                        padding: "6px 10px 4px",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: meta?.color ?? "var(--color-slate2, #64748b)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          backgroundColor: meta?.color ?? "var(--color-slate2)",
                          flexShrink: 0,
                        }}
                      />
                      {meta?.label ?? prod}
                    </p>
                    {prodOrgs.map((org) => renderOrgButton(org, true))}
                  </div>
                );
              })}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
