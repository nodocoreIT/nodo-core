import { useEffect, useRef, useState } from "react";
import { ChevronDown, Building2, Check, AlertCircle } from "lucide-react";
import { useSupabase } from "@nodocore/shared-components";
import { useMyOrgs } from "./use-my-orgs";
import type { OrgEntry } from "./types";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  agent: "Empleado",
  owner: "Propietario",
  tenant: "Inquilino",
};

export function NodoSwitcher() {
  const supabase = useSupabase();
  const { orgs, loading } = useMyOrgs();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Hide when user belongs to only one org (or still loading).
  if (loading || orgs.length <= 1) return null;

  const currentOrg = orgs.find((o) => o.org_id === currentOrgId) ?? orgs[0];

  async function handleSwitch(org: OrgEntry) {
    if (org.org_id === currentOrgId || switching) return;
    setOpen(false);
    setSwitching(true);
    setSwitchError(null);

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
      await supabase.auth.refreshSession();
      window.location.reload();
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : "No se pudo cambiar de organización");
      setSwitching(false);
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
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
        <Building2 size={14} style={{ flexShrink: 0 }} />
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {switching ? "Cambiando..." : (currentOrg?.org_name ?? "Organización")}
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

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 220,
            background: "white",
            border: "1px solid var(--color-mist)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(18,30,47,.12)",
            zIndex: 50,
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

          {orgs.map((org) => {
            const isCurrent = org.org_id === currentOrgId;
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
                {isCurrent && (
                  <Check size={14} color="var(--color-brand)" style={{ flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
