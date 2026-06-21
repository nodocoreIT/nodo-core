import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ArrowLeftRight,
  Building2,
  Car,
  Coins,
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
};

const PRODUCT_META: Record<string, { label: string; color: string; Icon: LucideIcon }> = {
  inmo: { label: "Nodo Inmo", color: "#da5a0e", Icon: Building2 },
  autos: { label: "Nodo Autos", color: "#C41E3A", Icon: Car },
  finanzas: { label: "Nodo Finanzas", color: "#059669", Icon: Coins },
};

function getProductIcon(product?: string): LucideIcon {
  return PRODUCT_META[product ?? ""]?.Icon ?? Building2;
}

const PRODUCT_PATHS: Record<string, string> = {
  inmo: "/inmo/admin/dashboard",
  autos: "/autos/admin/dashboard",
  finanzas: "/finanzas/admin/dashboard",
};

interface NodoSwitcherProps {
  /** Current product (e.g. "inmo"). Same-product orgs shown first, others grouped below. */
  product?: string;
}

export function NodoSwitcher({ product }: NodoSwitcherProps = {}) {
  const supabase = useSupabase();
  const { orgs: allOrgs, loading } = useMyOrgs();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  // Detect current org from JWT claims.
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const meta = data.session?.user?.app_metadata as
        | Record<string, string>
        | undefined;
      setCurrentOrgId(meta?.org_id ?? null);
    });
  }, [supabase]);

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

  // Hide when user belongs to only one org (or still loading).
  if (loading || allOrgs.length <= 1) return null;

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

  const currentOrg = sameProduct.find((o) => o.org_id === currentOrgId) ?? sameProduct[0];

  async function handleSwitch(org: OrgEntry) {
    if (org.org_id === currentOrgId || switching) return;
    setOpen(false);
    setSwitching(true);
    setSwitchingTo(org.org_name);
    setSwitchError(null);

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
        setSwitchError(detail);
        setSwitching(false);
        return;
      }

      // Refresh session so the JWT reflects the new org.
      // Retry once if the first refresh still has the old org_id.
      const { data: refreshed } = await supabase.auth.refreshSession();
      const newOrgId = refreshed?.session?.user?.app_metadata?.org_id;
      if (newOrgId !== org.org_id) {
        await new Promise((r) => setTimeout(r, 500));
        await supabase.auth.refreshSession();
      }

      if (isCrossNodo) {
        // Skip splash screens on the target nodo.
        try {
          sessionStorage.setItem(`nodo-${org.product}-skip-splash`, "1");
        } catch {
          // ignore
        }
        // Cross-nodo: navigate to the target nodo app.
        const targetPath = PRODUCT_PATHS[org.product] ?? `/${org.product}/admin/dashboard`;
        window.location.href = targetPath;
        // Reset state in case the navigation takes a moment.
        setSwitching(false);
        setSwitchingTo(null);
        return;
      }

      // Same-nodo: update state and invalidate cache.
      setCurrentOrgId(org.org_id);
      window.dispatchEvent(new CustomEvent("nodo:org-switched"));
      await new Promise((r) => setTimeout(r, 600));
      setSwitching(false);
      setSwitchingTo(null);
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : "No se pudo cambiar de organización");
      setSwitching(false);
    }
  }

  const switchOverlay = switching && switchingTo
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
            Cambiando a la organización de
          </p>
          <p
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--color-brand, #da5a0e)",
              textAlign: "center",
              margin: 0,
            }}
          >
            {switchingTo}
          </p>
        </div>,
        document.body,
      )
    : null;

  const CurrentProductIcon = getProductIcon(product);
  const currentProductColor = PRODUCT_META[product ?? ""]?.color ?? "var(--color-navy)";

  function renderOrgButton(org: OrgEntry, isCrossNodo = false) {
    const isCurrent = org.org_id === currentOrgId && !isCrossNodo;
    return (
      <button
        key={org.org_id}
        type="button"
        role="option"
        aria-selected={isCurrent}
        onClick={() => handleSwitch(org)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          textAlign: "left",
          border: "none",
          background: isCurrent ? "var(--color-paper)" : "transparent",
          padding: "9px 10px",
          borderRadius: 6,
          cursor: isCurrent ? "default" : "pointer",
          gap: 8,
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
            {org.org_name}
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
          <Check size={14} color="var(--color-brand)" style={{ flexShrink: 0 }} />
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
        <CurrentProductIcon size={14} color={currentProductColor} style={{ flexShrink: 0 }} />
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
              ? (currentOrg?.org_name?.split(/\s+/)[0] ?? "Org")
              : (currentOrg?.org_name ?? "Organización")}
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
            ...(isMobile
              ? { left: 12, right: 12 }
              : { right: dropdownPos.right, minWidth: 260 }),
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
                const meta = PRODUCT_META[prod];
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
