"use client";

import { useState, useEffect, Fragment } from "react";
import { Pencil, Trash2, ChevronDown, ChevronRight, Eye, EyeOff, Copy, Plus } from "lucide-react";
import Topbar from "@/components/panel/Topbar";
import { createClient } from "@/lib/supabase/client";
import { NODES } from "@/lib/nodes";
import { NODO_PLANS } from "@/lib/nodo-plans";

type ClientStatus = "activo" | "onboarding" | "pausado";

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  since: string | null;
  created_at: string;
};

type ClientUnit = {
  id: string;
  client_id: string;
  unit_code: string;
  plan: string | null;
  status: ClientStatus;
  progress: number;
  access_url: string | null;
  access_user: string | null;
  access_password: string | null;
  provisioned_at: string | null;
  provision_user_id: string | null;
};

// Local form representation of a nodo (with a stable key for React lists).
type FormUnit = {
  key: string;
  unit_code: string;
  plan: string;
  status: ClientStatus;
  progress: string;
  access_url: string;
  access_user: string;
  access_password: string;
  provisioned_at: string | null;
  provision_user_id: string | null;
};

const STATUS_STYLES: Record<ClientStatus, { bg: string; color: string; label: string }> = {
  activo: { bg: "#E1F0E8", color: "#1F8A5B", label: "Activo" },
  onboarding: { bg: "#FCE9D8", color: "#B5630C", label: "Onboarding" },
  pausado: { bg: "var(--color-mist)", color: "var(--color-slate2)", label: "Pausado" },
};

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function newFormUnit(): FormUnit {
  return {
    key: crypto.randomUUID(),
    unit_code: NODES[0]?.code ?? "",
    plan: "",
    status: "activo",
    progress: "0",
    access_url: "",
    access_user: "",
    access_password: "",
    provisioned_at: null,
    provision_user_id: null,
  };
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [units, setUnits] = useState<ClientUnit[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; label: string } | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formSince, setFormSince] = useState(today);
  const [formUnits, setFormUnits] = useState<FormUnit[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const supabase = createClient();
    const [{ data: cs }, { data: us }] = await Promise.all([
      supabase.from("clients").select("id, name, email, phone, since, created_at").order("created_at", { ascending: false }),
      supabase.from("client_units").select("*").order("created_at"),
    ]);
    setClients((cs ?? []) as Client[]);
    setUnits((us ?? []) as ClientUnit[]);
    setLoading(false);
  }

  const unitsByClient = new Map<string, ClientUnit[]>();
  for (const u of units) {
    const arr = unitsByClient.get(u.client_id) ?? [];
    arr.push(u);
    unitsByClient.set(u.client_id, arr);
  }

  const filtered = searchTerm
    ? clients.filter((c) => {
        const term = searchTerm.toLowerCase();
        const cu = unitsByClient.get(c.id) ?? [];
        return (
          c.name.toLowerCase().includes(term) ||
          (c.email?.toLowerCase().includes(term) ?? false) ||
          (c.phone?.toLowerCase().includes(term) ?? false) ||
          cu.some((u) => u.unit_code.toLowerCase().includes(term))
        );
      })
    : clients;

  // Stats (per-nodo)
  const activeCount = units.filter((u) => u.status === "activo").length;
  const onboardingCount = units.filter((u) => u.status === "onboarding").length;
  const distinctUnits = new Set(units.map((u) => u.unit_code)).size;
  const avgProgress = units.length > 0
    ? Math.round(units.reduce((acc, u) => acc + (u.progress ?? 0), 0) / units.length)
    : 0;

  function openAddForm() {
    setEditingClient(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormSince(today);
    setFormUnits([newFormUnit()]);
    setError("");
    setShowForm(true);
  }

  function openEditForm(c: Client) {
    setEditingClient(c);
    setFormName(c.name);
    setFormEmail(c.email ?? "");
    setFormPhone(c.phone ?? "");
    setFormSince(c.since ?? today);
    const cu = unitsByClient.get(c.id) ?? [];
    setFormUnits(
      cu.length > 0
        ? cu.map((u) => ({
            key: u.id,
            unit_code: u.unit_code,
            plan: u.plan ?? "",
            status: u.status,
            progress: String(u.progress ?? 0),
            access_url: u.access_url ?? "",
            access_user: u.access_user ?? "",
            access_password: u.access_password ?? "",
            provisioned_at: u.provisioned_at ?? null,
            provision_user_id: u.provision_user_id ?? null,
          }))
        : [newFormUnit()]
    );
    setError("");
    setShowForm(true);
  }

  function updateFormUnit(key: string, patch: Partial<FormUnit>) {
    setFormUnits((prev) => prev.map((u) => (u.key === key ? { ...u, ...patch } : u)));
  }

  function addFormUnit() {
    setFormUnits((prev) => [...prev, newFormUnit()]);
  }

  function removeFormUnit(key: string) {
    setFormUnits((prev) => prev.filter((u) => u.key !== key));
  }

  async function handleSave() {
    if (!formName.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();

    const clientPayload = {
      name: formName.trim(),
      email: formEmail.trim() || null,
      phone: formPhone.trim() || null,
      since: formSince,
    };

    let clientId: string;

    // Capture previous units before deleting — needed to detect provisioning changes.
    const prevUnits = editingClient ? (unitsByClient.get(editingClient.id) ?? []) : [];

    if (editingClient) {
      const { error: err } = await supabase.from("clients").update(clientPayload).eq("id", editingClient.id);
      if (err) {
        setError("Error al actualizar el cliente: " + err.message);
        setSaving(false);
        return;
      }
      clientId = editingClient.id;
      // Rebuild the nodos from scratch.
      await supabase.from("client_units").delete().eq("client_id", clientId);
    } else {
      const { data: inserted, error: err } = await supabase.from("clients").insert(clientPayload).select().single();
      if (err || !inserted) {
        setError("Error al crear el cliente: " + (err?.message ?? ""));
        setSaving(false);
        return;
      }
      clientId = inserted.id;
    }

    // Carry over provisioned_at and provision_user_id when the access_user didn't change.
    const unitRows = formUnits.map((u) => {
      const prev = prevUnits.find((p) => p.unit_code === u.unit_code);
      const sameUser = prev?.access_user === u.access_user.trim() && !!u.access_user.trim();
      return {
        client_id: clientId,
        unit_code: u.unit_code,
        plan: u.plan.trim() || null,
        status: u.status,
        progress: Math.max(0, Math.min(100, Number(u.progress) || 0)),
        access_url: u.access_url.trim() || null,
        access_user: u.access_user.trim() || null,
        access_password: u.access_password.trim() || null,
        provisioned_at: sameUser ? (prev?.provisioned_at ?? null) : null,
        provision_user_id: sameUser ? (prev?.provision_user_id ?? null) : null,
      };
    });

    if (unitRows.length > 0) {
      const { error: err } = await supabase.from("client_units").insert(unitRows);
      if (err) {
        setError("Cliente guardado pero error en los nodos: " + err.message);
        setSaving(false);
        return;
      }
    }

    // Map unit_code → nodo-user-id for suspend/reactivate (existing + newly provisioned).
    const provisionedUserIds = new Map<string, string>();
    for (const u of formUnits) {
      if (u.provision_user_id) provisionedUserIds.set(u.unit_code, u.provision_user_id);
    }

    // Provision admin users for onboarding/activo nodos with new or changed credentials.
    const provisionErrors: string[] = [];
    for (const u of formUnits) {
      const nodeDef = NODES.find((n) => n.code === u.unit_code);
      if (!nodeDef?.provisionable) continue;
      if (!u.access_user.trim() || !u.access_password.trim()) continue;
      if (u.status === "pausado") continue;

      const prev = prevUnits.find((p) => p.unit_code === u.unit_code);
      // Skip only when already provisioned AND user_id is already stored.
      // If user_id is missing (column was added after provisioning), re-call
      // provision so the route recovers and returns the existing user_id.
      const alreadyProvisioned =
        !!prev?.provisioned_at &&
        prev.access_user === u.access_user.trim() &&
        !!prev.provision_user_id;
      if (alreadyProvisioned) continue;

      const res = await fetch("/api/nodo-provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodo_code: u.unit_code,
          client_name: formName.trim(),
          email: u.access_user.trim(),
          password: u.access_password.trim(),
          plan: u.plan.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        const userId = json.user_id as string | undefined;
        if (userId) provisionedUserIds.set(u.unit_code, userId);
        await supabase
          .from("client_units")
          .update({ provisioned_at: new Date().toISOString(), provision_user_id: userId ?? null })
          .eq("client_id", clientId)
          .eq("unit_code", u.unit_code);
      } else {
        provisionErrors.push(`${nodeDef.label}: ${json.error ?? "error desconocido"}`);
      }
    }

    // Sync ban status: pausado → ban, onboarding/activo → unban.
    for (const u of formUnits) {
      const nodeDef = NODES.find((n) => n.code === u.unit_code);
      if (!nodeDef?.provisionable) continue;
      const userId = provisionedUserIds.get(u.unit_code);
      if (!userId) continue;
      await fetch("/api/nodo-suspend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodo_code: u.unit_code,
          user_id: userId,
          action: u.status === "pausado" ? "suspend" : "reactivate",
        }),
      });
    }

    // Sync plan tier in nodo app_metadata when plan field has a value.
    for (const u of formUnits) {
      const nodeDef = NODES.find((n) => n.code === u.unit_code);
      if (!nodeDef?.provisionable) continue;
      const userId = provisionedUserIds.get(u.unit_code);
      if (!userId || !u.plan) continue;
      await fetch("/api/nodo-plan-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodo_code: u.unit_code,
          user_id: userId,
          plan: u.plan,
        }),
      });
    }

    setSaving(false);
    if (provisionErrors.length > 0) {
      setError("Cliente guardado. Error al crear accesos: " + provisionErrors.join("; "));
      loadAll();
      return;
    }
    setShowForm(false);
    loadAll();
  }

  function requestDelete(id: string, name: string) {
    setConfirmDelete({ ids: [id], label: name });
  }

  function requestBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const label = ids.length === 1
      ? clients.find((c) => c.id === ids[0])?.name ?? "1 cliente"
      : `${ids.length} clientes`;
    setConfirmDelete({ ids, label });
  }

  async function performDelete() {
    if (!confirmDelete) return;
    const ids = confirmDelete.ids;
    const supabase = createClient();
    await supabase.from("clients").delete().in("id", ids);
    const idSet = new Set(ids);
    setClients((prev) => prev.filter((c) => !idSet.has(c.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setConfirmDelete(null);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id))));
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--color-mist)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13.5,
    fontFamily: "var(--font-sans)",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--color-slate2)",
    marginBottom: 4,
    display: "block",
  };

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <>
      <Topbar
        breadcrumb="Nodo Core · Gestión"
        title="Clientes"
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar clientes..."
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
        {/* Stats */}
        <div className="panel-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Nodos activos", value: activeCount },
            { label: "En onboarding", value: onboardingCount },
            { label: "Nodos distintos", value: distinctUnits },
            { label: "Avance promedio", value: `${avgProgress}%` },
          ].map((stat) => (
            <div key={stat.label} style={{ background: "white", border: "1px solid var(--color-mist)", borderRadius: 10, padding: "18px 20px" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--color-slate2)", fontWeight: 500, marginBottom: 6 }}>{stat.label}</p>
              <p style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, color: "var(--color-navy)" }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Header + actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-slate2)" }}>
            {selected.size > 0
              ? `${selected.size} seleccionado${selected.size === 1 ? "" : "s"}`
              : `${filtered.length} ${filtered.length === 1 ? "cliente" : "clientes"}`}
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            {selected.size > 0 && (
              <button onClick={requestBulkDelete} style={{ background: "#C0392B", color: "white", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                Eliminar ({selected.size})
              </button>
            )}
            <button onClick={openAddForm} style={{ background: "var(--color-brand)", color: "white", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
              + Agregar cliente
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: "white", border: "1px solid var(--color-mist)", borderRadius: 10, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--color-slate2)", fontSize: 14 }}>Cargando clientes...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--color-slate2)", fontSize: 14 }}>No se encontraron clientes.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--color-mist-200)" }}>
                  <th style={{ padding: "11px 16px", textAlign: "left", width: 40 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Seleccionar todos" style={{ accentColor: "var(--color-brand)", cursor: "pointer" }} />
                  </th>
                  {["Cliente", "Contacto", "Nodos", "Cliente desde", ""].map((col, i) => (
                    <th key={col || `c-${i}`} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-slate2)", whiteSpace: "nowrap" }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => {
                  const cu = unitsByClient.get(client.id) ?? [];
                  const isSelected = selected.has(client.id);
                  const isOpen = expanded.has(client.id);
                  return (
                    <Fragment key={client.id}>
                      <tr style={{ borderTop: "1px solid var(--color-mist)", background: isSelected ? "var(--color-paper)" : "transparent" }}>
                        <td style={{ padding: "13px 16px" }}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(client.id)} aria-label={`Seleccionar ${client.name}`} style={{ accentColor: "var(--color-brand)", cursor: "pointer" }} />
                        </td>

                        {/* Cliente */}
                        <td style={{ padding: "13px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--color-navy)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0 }}>
                              {getInitials(client.name)}
                            </div>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>{client.name}</p>
                          </div>
                        </td>

                        {/* Contacto */}
                        <td style={{ padding: "13px 16px", fontSize: 13, color: "var(--color-slate2)" }}>
                          {client.email && <div>{client.email}</div>}
                          {client.phone && <div>{client.phone}</div>}
                          {!client.email && !client.phone && "—"}
                        </td>

                        {/* Nodos */}
                        <td style={{ padding: "13px 16px" }}>
                          {cu.length === 0 ? (
                            <span style={{ fontSize: 13, color: "var(--color-slate2)" }}>—</span>
                          ) : (
                            <button
                              onClick={() => toggleExpand(client.id)}
                              style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                            >
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {cu.map((u) => {
                                  const st = STATUS_STYLES[u.status] ?? STATUS_STYLES.pausado;
                                  return (
                                    <span key={u.id} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11.5, background: "var(--color-mist-200)", borderRadius: 6, padding: "3px 8px", color: "var(--color-navy)", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 }}>
                                      nodo | {u.unit_code}
                                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.color }} />
                                    </span>
                                  );
                                })}
                              </div>
                              {isOpen ? <ChevronDown size={16} color="var(--color-slate2)" /> : <ChevronRight size={16} color="var(--color-slate2)" />}
                            </button>
                          )}
                        </td>

                        {/* Desde */}
                        <td style={{ padding: "13px 16px", fontSize: 13, color: "var(--color-slate2)", whiteSpace: "nowrap" }}>
                          {client.since ? formatDate(client.since) : "—"}
                        </td>

                        {/* Acciones */}
                        <td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => openEditForm(client)} aria-label={`Editar ${client.name}`} title="Editar" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, background: "transparent", color: "#2A6FDB", border: "1px solid #AFC6F0", borderRadius: 6, cursor: "pointer" }}>
                              <Pencil size={15} strokeWidth={2} />
                            </button>
                            <button onClick={() => requestDelete(client.id, client.name)} aria-label={`Eliminar ${client.name}`} title="Eliminar" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, background: "transparent", color: "#C0392B", border: "1px solid #F5C6C2", borderRadius: 6, cursor: "pointer" }}>
                              <Trash2 size={15} strokeWidth={2} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded: nodos detail + credentials */}
                      {isOpen && cu.length > 0 && (
                        <tr style={{ background: "var(--color-paper)" }}>
                          <td colSpan={6} style={{ padding: "4px 16px 16px 66px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                              {cu.map((u) => {
                                const st = STATUS_STYLES[u.status] ?? STATUS_STYLES.pausado;
                                const show = revealed.has(u.id);
                                return (
                                  <div key={u.id} style={{ background: "white", border: "1px solid var(--color-mist)", borderRadius: 10, padding: 14 }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--color-navy)" }}>
                                        nodo | {u.unit_code}
                                      </span>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        {u.provisioned_at && (
                                          <span style={{ fontSize: 11, fontWeight: 700, background: "#E1F0E8", color: "#1F8A5B", borderRadius: 999, padding: "2px 8px" }}>
                                            Acceso activo
                                          </span>
                                        )}
                                        <span style={{ fontSize: 11.5, fontWeight: 700, background: st.bg, color: st.color, borderRadius: 999, padding: "2px 9px" }}>{st.label}</span>
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                      <span style={{ fontSize: 12.5, color: "var(--color-slate2)" }}>Plan: <strong style={{ color: "var(--color-ink)" }}>{u.plan ?? "—"}</strong></span>
                                      <span style={{ fontSize: 12.5, color: "var(--color-slate2)" }}>· Avance: <strong style={{ color: "var(--color-ink)" }}>{u.progress ?? 0}%</strong></span>
                                    </div>

                                    {/* Credentials */}
                                    <div style={{ borderTop: "1px solid var(--color-mist)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                                      <CredRow label="URL" value={u.access_url} onCopy={copy} />
                                      <CredRow label="Usuario" value={u.access_user} onCopy={copy} />
                                      <CredRow
                                        label="Contraseña"
                                        value={u.access_password ? (show ? u.access_password : "••••••••") : null}
                                        rawValue={u.access_password}
                                        onCopy={copy}
                                        reveal={{ shown: show, onToggle: () => toggleReveal(u.id), hasValue: !!u.access_password }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Delete confirmation modal */}
        {confirmDelete && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(18,30,47,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: 16 }}>
            <div style={{ background: "white", borderRadius: 12, width: "min(380px, 96vw)", boxShadow: "0 12px 40px rgba(18,30,47,.18)", padding: 24 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-navy)", fontFamily: "var(--font-display)" }}>Eliminar</h3>
              <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--color-slate2)", lineHeight: 1.5 }}>
                ¿Seguro que querés eliminar <strong style={{ color: "var(--color-ink)" }}>{confirmDelete.label}</strong>? Se borran también sus nodos y accesos. Esta acción no se puede deshacer.
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={performDelete} style={{ flex: 1, background: "#C0392B", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>Eliminar</button>
                <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, background: "transparent", color: "var(--color-slate2)", border: "1px solid var(--color-mist)", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* Form modal */}
        {showForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(18,30,47,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
            <div style={{ background: "white", borderRadius: 12, width: "min(560px, 96vw)", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(18,30,47,.18)" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--color-mist)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "white", zIndex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-navy)", fontFamily: "var(--font-display)" }}>
                  {editingClient ? "Editar cliente" : "Nuevo cliente"}
                </h3>
                <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-slate2)", fontSize: 20, lineHeight: 1, padding: "2px 4px" }}>×</button>
              </div>

              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Nombre</label>
                  <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} style={inputStyle} placeholder="Nombre del cliente o empresa" autoComplete="off" />
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Email</label>
                    <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} style={inputStyle} placeholder="cliente@ejemplo.com" autoComplete="off" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Celular</label>
                    <input type="text" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} style={inputStyle} placeholder="+54 9 ..." autoComplete="off" />
                  </div>
                </div>

                <div style={{ width: "50%" }}>
                  <label style={labelStyle}>Cliente desde</label>
                  <input type="date" value={formSince} onChange={(e) => setFormSince(e.target.value)} style={inputStyle} />
                </div>

                {/* Nodos */}
                <div style={{ borderTop: "1px solid var(--color-mist)", paddingTop: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-navy)" }}>Nodos comprados</span>
                    <button onClick={addFormUnit} style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", color: "var(--color-brand)", border: "1px solid var(--color-brand)", borderRadius: 6, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                      <Plus size={14} strokeWidth={2.5} /> Agregar nodo
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {formUnits.map((u, idx) => (
                      <div key={u.key} style={{ border: "1px solid var(--color-mist)", borderRadius: 10, padding: 14, background: "var(--color-paper)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-slate2)" }}>Nodo {idx + 1}</span>
                          {formUnits.length > 1 && (
                            <button onClick={() => removeFormUnit(u.key)} aria-label="Quitar nodo" title="Quitar" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: "transparent", color: "#C0392B", border: "1px solid #F5C6C2", borderRadius: 6, cursor: "pointer" }}>
                              <Trash2 size={13} strokeWidth={2} />
                            </button>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Módulo</label>
                            <select
                              value={u.unit_code}
                              onChange={(e) => {
                                const newCode = e.target.value;
                                const nodePlans = NODO_PLANS.find((n) => n.slug === newCode.toLowerCase());
                                const firstPlan = nodePlans?.plans ? Object.keys(nodePlans.plans)[0] : "";
                                updateFormUnit(u.key, { unit_code: newCode, plan: firstPlan });
                              }}
                              style={inputStyle}
                            >
                              {NODES.map((n) => <option key={n.code} value={n.code}>{n.label}</option>)}
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Plan</label>
                            {(() => {
                              const nodePlans = NODO_PLANS.find((n) => n.slug === u.unit_code.toLowerCase());
                              if (nodePlans?.plans) {
                                return (
                                  <select value={u.plan} onChange={(e) => updateFormUnit(u.key, { plan: e.target.value })} style={inputStyle}>
                                    {Object.entries(nodePlans.plans).map(([tier, pricing]) => (
                                      <option key={tier} value={tier}>
                                        {tier.charAt(0).toUpperCase() + tier.slice(1)} — {pricing.currency} {pricing.monthly}/mes
                                      </option>
                                    ))}
                                  </select>
                                );
                              }
                              return (
                                <input type="text" value={u.plan} onChange={(e) => updateFormUnit(u.key, { plan: e.target.value })} style={inputStyle} placeholder="Plan..." />
                              );
                            })()}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Estado</label>
                            <select value={u.status} onChange={(e) => updateFormUnit(u.key, { status: e.target.value as ClientStatus })} style={inputStyle}>
                              <option value="activo">Activo</option>
                              <option value="onboarding">Onboarding</option>
                              <option value="pausado">Pausado</option>
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Avance (%)</label>
                            <input type="number" value={u.progress} onChange={(e) => updateFormUnit(u.key, { progress: e.target.value })} style={inputStyle} min="0" max="100" />
                          </div>
                        </div>

                        <p style={{ margin: "4px 0 8px", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-slate2)" }}>
                          Accesos a la plataforma
                        </p>
                        <div style={{ marginBottom: 10 }}>
                          <label style={labelStyle}>URL</label>
                          <input type="text" value={u.access_url} onChange={(e) => updateFormUnit(u.key, { access_url: e.target.value })} style={inputStyle} placeholder="https://inmo.nodocore.com.ar" autoComplete="off" />
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Usuario (email)</label>
                            <input type="text" value={u.access_user} onChange={(e) => updateFormUnit(u.key, { access_user: e.target.value })} style={inputStyle} autoComplete="off" />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Contraseña</label>
                            <input type="text" value={u.access_password} onChange={(e) => updateFormUnit(u.key, { access_password: e.target.value })} style={inputStyle} autoComplete="off" />
                          </div>
                        </div>
                        {(() => {
                          const nodeDef = NODES.find((n) => n.code === u.unit_code);
                          if (!nodeDef?.provisionable) return null;
                          if (!u.access_user.trim() || !u.access_password.trim()) return null;
                          if (u.status !== "activo") return null;
                          if (u.provisioned_at) {
                            return (
                              <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "#1F8A5B", fontWeight: 600 }}>
                                ✓ Acceso ya creado en {nodeDef.label}
                              </p>
                            );
                          }
                          return (
                            <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "#2A6FDB", fontWeight: 500 }}>
                              Al guardar se creará el acceso de administrador en {nodeDef.label}.
                            </p>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>

                {error && <p style={{ margin: 0, fontSize: 12.5, color: "#C0392B" }}>{error}</p>}

                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: "var(--color-brand)", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)", opacity: saving ? 0.7 : 1 }}>
                    {saving ? "Guardando..." : editingClient ? "Guardar cambios" : "Crear cliente"}
                  </button>
                  <button onClick={() => setShowForm(false)} style={{ flex: 1, background: "transparent", color: "var(--color-slate2)", border: "1px solid var(--color-mist)", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Credential row (label + value + copy, optional reveal) ──────────────────
function CredRow({
  label,
  value,
  rawValue,
  onCopy,
  reveal,
}: {
  label: string;
  value: string | null;
  rawValue?: string | null;
  onCopy: (text: string) => void;
  reveal?: { shown: boolean; onToggle: () => void; hasValue: boolean };
}) {
  const copyText = rawValue !== undefined ? rawValue : value;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-slate2)", width: 72, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: value ? "var(--color-ink)" : "var(--color-slate2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: label === "Contraseña" ? "monospace" : "var(--font-sans)" }}>
        {value ?? "—"}
      </span>
      {reveal?.hasValue && (
        <button onClick={reveal.onToggle} aria-label={reveal.shown ? "Ocultar" : "Mostrar"} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-slate2)", display: "flex", padding: 2 }}>
          {reveal.shown ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      )}
      {copyText && (
        <button onClick={() => onCopy(copyText)} aria-label="Copiar" title="Copiar" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-slate2)", display: "flex", padding: 2 }}>
          <Copy size={14} />
        </button>
      )}
    </div>
  );
}
