"use client";

import { useState, useEffect, Fragment } from "react";
import { Pencil, Trash2, ChevronDown, ChevronRight, Eye, EyeOff, Copy, Plus, RotateCcw, Database, AlertTriangle, Loader2 } from "lucide-react";
import Topbar from "@/components/panel/Topbar";
import { createClient } from "@/lib/supabase/client";
import { NODES, unitHasClientAccessCredentials, type NodeDef } from "@/lib/nodes";
import {
  defaultPlanCodeForUnit,
  getPlanSelectOptions,
  normalizePlanCode,
  type NodePlan,
} from "@/lib/panel/planes";
import { FormSelect } from "@nodocore/shared-components";

type ClientStatus =
  | "activo"
  | "onboarding"
  | "pausado"
  | "pending_review"
  | "pending_onboarding";

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
  pending_review: { bg: "#FCE9D8", color: "#B5630C", label: "Pendiente revisión" },
  pending_onboarding: { bg: "#E8EEF8", color: "#2A6FDB", label: "Onboarding pendiente" },
};

const ALL_STATUSES: ClientStatus[] = [
  "activo",
  "pausado",
  "pending_review",
  "pending_onboarding",
  "onboarding",
];

function statusStyle(status: string) {
  return STATUS_STYLES[status as ClientStatus] ?? STATUS_STYLES.pausado;
}

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getAssignableNodes(usedCodes: string[]): NodeDef[] {
  const used = new Set(usedCodes);
  return NODES.filter((node) => !used.has(node.code));
}

function createFormUnit(unitCode: string, planes: NodePlan[]): FormUnit {
  return {
    key: crypto.randomUUID(),
    unit_code: unitCode,
    plan: defaultPlanCodeForUnit(planes, unitCode),
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
  const [planes, setPlanes] = useState<NodePlan[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [statusMenuUnitId, setStatusMenuUnitId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; label: string } | null>(null);
  const [activeUnitKey, setActiveUnitKey] = useState<string>("");
  const [resettingUnitKey, setResettingUnitKey] = useState<string | null>(null);
  const [purgingUnitKey, setPurgingUnitKey] = useState<string | null>(null);
  const [purgeConfirmUnit, setPurgeConfirmUnit] = useState<FormUnit | null>(null);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [purgeConfirmPassword, setPurgeConfirmPassword] = useState("");
  const [purgeModalError, setPurgeModalError] = useState("");
  const [dashboardUserEmail, setDashboardUserEmail] = useState("");
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [showAddNodoPicker, setShowAddNodoPicker] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formSince, setFormSince] = useState(today);
  const [formUnits, setFormUnits] = useState<FormUnit[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    async function loadDashboardEmail() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) setDashboardUserEmail(user.email);
    }
    void loadDashboardEmail();
  }, []);

  useEffect(() => {
    if (!statusMenuUnitId) return;
    function onDocClick() {
      setStatusMenuUnitId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [statusMenuUnitId]);

  async function loadAll() {
    const supabase = createClient();
    const [{ data: cs }, { data: us }, { data: ps }] = await Promise.all([
      supabase.from("clients").select("id, name, email, phone, since, created_at").order("created_at", { ascending: false }),
      supabase.from("client_units").select("*").order("created_at"),
      supabase
        .from("planes")
        .select("id, unit_code, code, label, price_monthly, price_annual_monthly, currency, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order"),
    ]);
    setClients((cs ?? []) as Client[]);
    setUnits((us ?? []) as ClientUnit[]);
    setPlanes((ps ?? []) as NodePlan[]);
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
    const firstUnit = createFormUnit(NODES[0]?.code ?? "", planes);
    setFormUnits([firstUnit]);
    setActiveUnitKey(firstUnit.key);
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
    const mappedUnits =
      cu.length > 0
        ? cu.map((u) => ({
            key: u.id,
            unit_code: u.unit_code,
            plan: normalizePlanCode(planes, u.unit_code, u.plan),
            status: u.status,
            progress: String(u.progress ?? 0),
            access_url: u.access_url ?? "",
            access_user: u.access_user ?? "",
            access_password: u.access_password ?? "",
            provisioned_at: u.provisioned_at ?? null,
            provision_user_id: u.provision_user_id ?? null,
          }))
        : [createFormUnit(NODES[0]?.code ?? "", planes)];
    setFormUnits(mappedUnits);
    setActiveUnitKey(mappedUnits[0]?.key ?? "");
    setError("");
    setShowForm(true);
  }

  function updateFormUnit(key: string, patch: Partial<FormUnit>) {
    setFormUnits((prev) => prev.map((u) => (u.key === key ? { ...u, ...patch } : u)));
  }

  function addFormUnitWithCode(unitCode: string) {
    const unit = createFormUnit(unitCode, planes);
    setFormUnits((prev) => [...prev, unit]);
    setActiveUnitKey(unit.key);
    setShowAddNodoPicker(false);
    setError("");
  }

  function openAddNodoPicker() {
    const available = getAssignableNodes(formUnits.map((u) => u.unit_code));
    if (available.length === 0) {
      setError("Este cliente ya tiene todos los nodos del ecosistema asignados.");
      return;
    }
    if (available.length === 1) {
      addFormUnitWithCode(available[0].code);
      return;
    }
    setShowAddNodoPicker(true);
  }

  function removeFormUnit(key: string) {
    const next = formUnits.filter((u) => u.key !== key);
    setFormUnits(next);
    if (activeUnitKey === key) {
      setActiveUnitKey(next[0]?.key ?? "");
    }
  }

  async function handleSave() {
    if (!formName.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    for (const u of formUnits) {
      if (u.status === "pausado") continue;
      if (!unitHasClientAccessCredentials(u.access_user)) continue;
      const pwd = u.access_password.trim();
      if (!pwd) continue;
      const nodeDef = NODES.find((n) => n.code === u.unit_code);
      if (pwd.length < 8) {
        setError(
          `${nodeDef?.label ?? u.unit_code}: la contraseña de acceso debe tener al menos 8 caracteres (debe coincidir con Auth).`,
        );
        return;
      }
    }

    setSaving(true);
    setError("");
    setNoticeMessage(null);
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
        unit_code: u.unit_code,
        plan: normalizePlanCode(planes, u.unit_code, u.plan.trim()) || null,
        status: u.status,
        progress: Math.max(0, Math.min(100, Number(u.progress) || 0)),
        access_url: u.access_url.trim() || null,
        access_user: u.access_user.trim() || null,
        access_password: u.access_password.trim() || null,
        provisioned_at: sameUser ? (prev?.provisioned_at ?? null) : null,
        provision_user_id: sameUser ? (prev?.provision_user_id ?? null) : null,
      };
    });

    const unitsRes = await fetch("/api/admin/save-client-units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, units: unitRows }),
    });
    const unitsJson = await unitsRes.json();
    if (!unitsRes.ok || !unitsJson.ok) {
      setError("Cliente guardado pero error en los nodos: " + (unitsJson.error ?? "error desconocido"));
      setSaving(false);
      return;
    }

    // Map unit_code → nodo-user-id for suspend/reactivate (existing + newly provisioned).
    const provisionedUserIds = new Map<string, string>();
    for (const u of formUnits) {
      if (u.provision_user_id) provisionedUserIds.set(u.unit_code, u.provision_user_id);
    }

    // Provision admin users for onboarding/activo nodos with new or changed credentials.
    const provisionErrors: string[] = [];
    const freshlyProvisioned = new Set<string>();
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
        freshlyProvisioned.add(u.unit_code);
        await supabase
          .from("client_units")
          .update({ provisioned_at: new Date().toISOString(), provision_user_id: userId ?? null })
          .eq("client_id", clientId)
          .eq("unit_code", u.unit_code);
      } else {
        provisionErrors.push(`${nodeDef.label}: ${json.error ?? "error desconocido"}`);
      }
    }

    // Register access_user in node_email_access (login guard for nodos).
    const syncAccessRes = await fetch("/api/admin/sync-client-unit-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId }),
    });
    const syncAccessJson = await syncAccessRes.json();
    if (!syncAccessRes.ok || !syncAccessJson.ok) {
      provisionErrors.push(
        `Acceso al nodo: ${syncAccessJson.error ?? "no se pudo sincronizar el email de acceso"}`,
      );
    }

    // Sync password + Auth claims on every save (idempotent repair for dashboard clients).
    for (const u of formUnits) {
      if (!unitHasClientAccessCredentials(u.access_user)) continue;
      const newPassword = u.access_password.trim();
      if (!newPassword || u.status === "pausado") continue;

      const nodeDef = NODES.find((n) => n.code === u.unit_code);
      const res = await fetch("/api/admin/client-unit-password-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          unit_code: u.unit_code,
          password: newPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        provisionErrors.push(
          `${nodeDef?.label ?? u.unit_code} (contraseña): ${json.error ?? "error desconocido"}`,
        );
      } else if (json.user_id) {
        provisionedUserIds.set(u.unit_code, json.user_id as string);
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

    // Sync plan tier in nodo app_metadata when the plan changed or was set.
    for (const u of formUnits) {
      const nodeDef = NODES.find((n) => n.code === u.unit_code);
      if (!nodeDef?.provisionable) continue;

      const userId = provisionedUserIds.get(u.unit_code) ?? u.provision_user_id;
      const nextPlan = u.plan.trim();
      if (!userId || !nextPlan) continue;

      const prev = prevUnits.find((p) => p.unit_code === u.unit_code);
      const prevPlan = normalizePlanCode(planes, u.unit_code, prev?.plan ?? "");
      const normalizedNextPlan = normalizePlanCode(planes, u.unit_code, nextPlan);
      if (prevPlan === normalizedNextPlan && prev?.provision_user_id) continue;

      await fetch("/api/nodo-plan-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodo_code: u.unit_code,
          user_id: userId,
          plan: normalizedNextPlan,
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

  async function resetUnitPassword(unit: FormUnit) {
    const savedUnitIds = new Set((editingClient ? unitsByClient.get(editingClient.id) : [])?.map((u) => u.id) ?? []);
    if (!editingClient || !savedUnitIds.has(unit.key)) {
      setError("Primero guardá el cliente para poder blanquear el acceso.");
      return;
    }
    if (!unit.access_user.trim()) {
      setError("El nodo necesita un email de acceso para blanquear la contraseña.");
      return;
    }

    setResettingUnitKey(unit.key);
    setError("");
    const res = await fetch("/api/admin/client-unit-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_unit_id: unit.key }),
    });
    const json = await res.json();
    setResettingUnitKey(null);

    if (!res.ok || !json.ok) {
      setError(json.error ?? "No se pudo blanquear la contraseña.");
      return;
    }

    updateFormUnit(unit.key, {
      access_password: json.password,
      provision_user_id: json.user_id ?? unit.provision_user_id,
    });
    copy(json.password);
    setNoticeMessage(
      "Contraseña blanqueada. El usuario deberá definir una clave nueva al ingresar.",
    );
  }

  function closePurgeModal() {
    if (purgingUnitKey) return;
    setPurgeConfirmUnit(null);
    setPurgeConfirmText("");
    setPurgeConfirmPassword("");
    setPurgeModalError("");
  }

  function canConfirmPurge() {
    return (
      purgeConfirmText.trim().toUpperCase() === "BORRAR" &&
      purgeConfirmPassword.trim().length >= 6
    );
  }

  async function purgeUnitData(unit: FormUnit) {
    const savedUnitIds = new Set((editingClient ? unitsByClient.get(editingClient.id) : [])?.map((u) => u.id) ?? []);
    if (!editingClient || !savedUnitIds.has(unit.key)) {
      setError("Primero guardá el cliente para poder borrar datos del nodo.");
      return;
    }
    if (!unit.provisioned_at || !unit.provision_user_id) {
      setError("Este nodo no tiene acceso provisionado todavía.");
      return;
    }
    if (!canConfirmPurge()) {
      setPurgeModalError("Escribí BORRAR y tu contraseña del dashboard para continuar.");
      return;
    }

    setPurgingUnitKey(unit.key);
    setPurgeModalError("");
    setError("");

    try {
      const res = await fetch("/api/admin/purge-nodo-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_unit_id: unit.key,
          confirm: purgeConfirmText,
          password: purgeConfirmPassword,
        }),
      });

      let json: { ok?: boolean; error?: string; counts?: Record<string, number>; storage_files_removed?: number };
      const raw = await res.text();
      try {
        json = raw ? (JSON.parse(raw) as typeof json) : {};
      } catch {
        json = {
          ok: false,
          error: `Error del servidor (${res.status}). Intentá de nuevo en unos segundos.`,
        };
      }

      if (!res.ok || json.ok === false) {
        const message = json.error ?? "No se pudieron borrar los datos del nodo.";
        setPurgeModalError(message);
        alert(message);
        return;
      }

      closePurgeModal();

      const totalRows = Object.values(json.counts ?? {}).reduce(
        (acc: number, n) => acc + (typeof n === "number" ? n : 0),
        0,
      );
      const storageNote =
        typeof json.storage_files_removed === "number" && json.storage_files_removed > 0
          ? ` Se eliminaron ${json.storage_files_removed} archivo(s) en Storage.`
          : "";
      setNoticeMessage(
        `Datos operativos borrados (${totalRows} filas en total). El acceso del administrador se mantiene.${storageNote}`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo conectar con el servidor. Verificá tu conexión.";
      setPurgeModalError(message);
      alert(message);
    } finally {
      setPurgingUnitKey(null);
    }
  }

  async function handleStatusChange(unitId: string, newStatus: ClientStatus) {
    setStatusUpdating(unitId);
    setStatusMenuUnitId(null);
    const res = await fetch("/api/admin/client-unit-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_unit_id: unitId, status: newStatus }),
    });
    setStatusUpdating(null);
    if (res.ok) {
      setUnits((prev) =>
        prev.map((u) => (u.id === unitId ? { ...u, status: newStatus } : u)),
      );
    } else {
      const json = await res.json();
      alert(json.error ?? "No se pudo actualizar el estado.");
    }
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

  const modalSelectProps = { contentClassName: "z-[200]" } as const;

  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const activeFormUnit = formUnits.find((u) => u.key === activeUnitKey) ?? formUnits[0];
  const assignableNodes = getAssignableNodes(formUnits.map((u) => u.unit_code));

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
                  {["Cliente", "Contacto", "Estado", "Nodos", "Cliente desde", ""].map((col, i) => (
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

                        {/* Estado */}
                        <td style={{ padding: "13px 16px", verticalAlign: "top" }}>
                          {cu.length === 0 ? (
                            <span style={{ fontSize: 13, color: "var(--color-slate2)" }}>—</span>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {cu.map((u) => {
                                const st = statusStyle(u.status);
                                const menuOpen = statusMenuUnitId === u.id;
                                return (
                                  <div key={u.id} style={{ position: "relative" }}>
                                    <button
                                      type="button"
                                      disabled={statusUpdating === u.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setStatusMenuUnitId(menuOpen ? null : u.id);
                                      }}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        background: st.bg,
                                        color: st.color,
                                        border: "1px solid transparent",
                                        borderRadius: 999,
                                        padding: "4px 10px",
                                        cursor: statusUpdating === u.id ? "not-allowed" : "pointer",
                                        opacity: statusUpdating === u.id ? 0.6 : 1,
                                      }}
                                    >
                                      <span style={{ fontSize: 10, opacity: 0.85 }}>{u.unit_code}</span>
                                      {statusUpdating === u.id ? "…" : st.label}
                                    </button>
                                    {menuOpen && (
                                      <div
                                        style={{
                                          position: "absolute",
                                          top: "100%",
                                          left: 0,
                                          marginTop: 4,
                                          background: "white",
                                          border: "1px solid var(--color-mist)",
                                          borderRadius: 8,
                                          boxShadow: "0 8px 24px rgba(18,30,47,.12)",
                                          zIndex: 20,
                                          minWidth: 180,
                                          padding: 4,
                                        }}
                                      >
                                        {ALL_STATUSES.map((s) => {
                                          const opt = statusStyle(s);
                                          return (
                                            <button
                                              key={s}
                                              type="button"
                                              onClick={() => handleStatusChange(u.id, s)}
                                              style={{
                                                display: "block",
                                                width: "100%",
                                                textAlign: "left",
                                                border: "none",
                                                background: u.status === s ? "var(--color-paper)" : "transparent",
                                                padding: "8px 10px",
                                                fontSize: 12.5,
                                                fontWeight: 600,
                                                color: opt.color,
                                                cursor: "pointer",
                                                borderRadius: 6,
                                              }}
                                            >
                                              {opt.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
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
                                  const st = statusStyle(u.status);
                                  const NODE_PILL_COLORS: Record<string, { bg: string; color: string }> = {
                                    autos:     { bg: "#B92737", color: "#ffffff" },
                                    finanzas:  { bg: "#047D5B", color: "#ffffff" },
                                    ecommerce: { bg: "#DDD400", color: "#000000" },
                                    clinica:   { bg: "#0F7E74", color: "#ffffff" },
                                    salud:     { bg: "#0F7E74", color: "#ffffff" },
                                    inmo:      { bg: "#CA460D", color: "#ffffff" },
                                  };
                                  const pillTheme = NODE_PILL_COLORS[u.unit_code?.toLowerCase() ?? ""] ?? { bg: "var(--color-mist-200)", color: "var(--color-navy)" };
                                  return (
                                    <span key={u.id} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11.5, background: pillTheme.bg, borderRadius: 6, padding: "3px 8px", color: pillTheme.color, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 }}>
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
                          <td colSpan={7} style={{ padding: "4px 16px 16px 66px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                              {cu.map((u) => {
                                const st = statusStyle(u.status);
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

        {purgeConfirmUnit && (() => {
          const isPurging = purgingUnitKey === purgeConfirmUnit.key;
          return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(18,30,47,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120, padding: 16 }}>
            <div style={{ background: "white", borderRadius: 14, width: "min(480px, 96vw)", boxShadow: "0 16px 48px rgba(18,30,47,.22)", overflow: "hidden", position: "relative" }}>
              {isPurging && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.72)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, zIndex: 2 }}>
                  <Loader2 size={28} color="#DC2626" style={{ animation: "spin 1s linear infinite" }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#991B1B" }}>Borrando datos del nodo...</p>
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-slate2)" }}>No cierres esta ventana.</p>
                </div>
              )}
              <div style={{ background: "#FEF2F2", borderBottom: "1px solid #FECACA", padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 999, background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <AlertTriangle size={20} color="#DC2626" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#991B1B", fontFamily: "var(--font-display)" }}>
                      Borrar datos del nodo
                    </h3>
                    <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "#7F1D1D", lineHeight: 1.5, fontWeight: 600 }}>
                      Esta acción es permanente y no se puede revertir.
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ padding: "20px 24px 24px" }}>
                <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--color-ink)", lineHeight: 1.55 }}>
                  Vas a eliminar <strong>todos los datos operativos</strong> de{" "}
                  <strong>{NODES.find((n) => n.code === purgeConfirmUnit.unit_code)?.label ?? purgeConfirmUnit.unit_code}</strong>{" "}
                  para este cliente.
                </p>
                <ul style={{ margin: "0 0 16px", paddingLeft: 18, fontSize: 13, color: "var(--color-slate2)", lineHeight: 1.6 }}>
                  <li>Propiedades, contratos, contactos, pagos y caja</li>
                  <li>Documentos, reclamos, tareas y movimientos</li>
                  <li>Usuarios del equipo (excepto el administrador)</li>
                </ul>
                <p style={{ margin: "0 0 18px", fontSize: 13, color: "#7F1D1D", lineHeight: 1.5 }}>
                  No hay forma de recuperar esta información después. El acceso del administrador al panel se mantiene.
                </p>

                <label style={{ ...labelStyle, display: "block" }}>
                  Tu contraseña del dashboard{dashboardUserEmail ? ` (${dashboardUserEmail})` : ""}
                </label>
                <input
                  type="password"
                  value={purgeConfirmPassword}
                  onChange={(e) => {
                    setPurgeConfirmPassword(e.target.value);
                    setPurgeModalError("");
                  }}
                  disabled={isPurging}
                  style={{ ...inputStyle, marginBottom: 12, opacity: isPurging ? 0.6 : 1 }}
                  autoComplete="current-password"
                  placeholder="Contraseña con la que entrás al panel"
                />

                <label style={{ ...labelStyle, display: "block" }}>
                  Escribí <strong>BORRAR</strong> para confirmar
                </label>
                <input
                  type="text"
                  value={purgeConfirmText}
                  onChange={(e) => {
                    setPurgeConfirmText(e.target.value);
                    setPurgeModalError("");
                  }}
                  disabled={isPurging}
                  style={{ ...inputStyle, opacity: isPurging ? 0.6 : 1 }}
                  autoComplete="off"
                  placeholder="BORRAR"
                />

                {purgeModalError && (
                  <div style={{ margin: "12px 0 0", padding: "10px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: "#C0392B", fontWeight: 600, lineHeight: 1.45 }}>{purgeModalError}</p>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  <button
                    type="button"
                    onClick={() => purgeUnitData(purgeConfirmUnit)}
                    disabled={isPurging || !canConfirmPurge()}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#DC2626", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: isPurging || !canConfirmPurge() ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)", opacity: isPurging || !canConfirmPurge() ? 0.55 : 1 }}
                  >
                    {isPurging ? (
                      <>
                        <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                        Borrando...
                      </>
                    ) : (
                      "Sí, borrar permanentemente"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={closePurgeModal}
                    disabled={isPurging}
                    style={{ flex: 1, background: "transparent", color: "var(--color-slate2)", border: "1px solid var(--color-mist)", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: isPurging ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)", opacity: isPurging ? 0.55 : 1 }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
          );
        })()}

        {showAddNodoPicker && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(18,30,47,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: 16 }}>
            <div style={{ background: "white", borderRadius: 12, width: "min(640px, 96vw)", maxHeight: "82vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(18,30,47,.18)", padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-navy)", fontFamily: "var(--font-display)" }}>
                  Elegí el nodo a agregar
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddNodoPicker(false)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-slate2)", fontSize: 20, lineHeight: 1, padding: "2px 4px" }}
                >
                  ×
                </button>
              </div>
              <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--color-slate2)", lineHeight: 1.5 }}>
                Seleccioná qué módulo del ecosistema querés contratar para este cliente.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {assignableNodes.map((node) => {
                  const Icon = node.Icon;
                  return (
                    <button
                      key={node.code}
                      type="button"
                      onClick={() => addFormUnitWithCode(node.code)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 10,
                        textAlign: "left",
                        background: "var(--color-paper)",
                        border: "1px solid var(--color-mist)",
                        borderRadius: 12,
                        padding: "14px 16px",
                        cursor: "pointer",
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: "white",
                            color: "var(--color-navy)",
                            border: "1px solid var(--color-mist)",
                          }}
                        >
                          <Icon size={18} strokeWidth={2.2} />
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-navy)" }}>{node.label}</span>
                      </div>
                      <span style={{ fontSize: 12.5, color: "var(--color-slate2)", lineHeight: 1.45 }}>
                        {node.description}
                      </span>
                      {node.inDevelopment && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#B5630C", background: "#FCE9D8", borderRadius: 999, padding: "3px 8px" }}>
                          En desarrollo
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Form modal */}
        {showForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(18,30,47,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
            <div style={{ background: "white", borderRadius: 12, width: "min(760px, 96vw)", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(18,30,47,.18)" }}>
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
                <div style={{ borderTop: "1px solid var(--color-mist)", paddingTop: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-navy)" }}>Nodos comprados</span>
                      <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--color-slate2)" }}>
                        Cada pestaña representa un módulo contratado por el cliente.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openAddNodoPicker}
                      disabled={assignableNodes.length === 0}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        background: "transparent",
                        color: "var(--color-brand)",
                        border: "1px solid var(--color-brand)",
                        borderRadius: 8,
                        padding: "7px 12px",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: assignableNodes.length === 0 ? "not-allowed" : "pointer",
                        fontFamily: "var(--font-sans)",
                        flexShrink: 0,
                        opacity: assignableNodes.length === 0 ? 0.5 : 1,
                      }}
                    >
                      <Plus size={14} strokeWidth={2.5} /> Agregar nodo
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
                    {formUnits.map((u, idx) => {
                      const active = activeFormUnit?.key === u.key;
                      const st = statusStyle(u.status);
                      const matchedNodeDef = NODES.find((n) => n.code.toLowerCase() === u.unit_code?.toLowerCase()) ?? NODES.find((n) => n.slug.toLowerCase() === u.unit_code?.toLowerCase());
                      const nodeLabel = matchedNodeDef?.label ?? u.unit_code ?? `Nodo ${idx + 1}`;
                      return (
                        <button
                          key={u.key}
                          type="button"
                          onClick={() => setActiveUnitKey(u.key)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            border: active ? "1px solid var(--color-brand)" : "1px solid var(--color-mist)",
                            background: active ? "rgba(218,90,14,.08)" : "white",
                            color: active ? "var(--color-brand)" : "var(--color-ink)",
                            borderRadius: 999,
                            padding: "8px 12px",
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            fontFamily: "var(--font-sans)",
                          }}
                        >
                          <span>{nodeLabel}</span>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.color }} />
                        </button>
                      );
                    })}
                  </div>

                  {activeFormUnit && (
                    <div style={{ border: "1px solid var(--color-mist)", borderRadius: 14, padding: 16, background: "var(--color-paper)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "var(--color-navy)", fontFamily: "var(--font-display)" }}>
                            {NODES.find((n) => n.code === activeFormUnit.unit_code)?.label ?? "Nodo"}
                          </p>
                          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--color-slate2)" }}>
                            Configuración comercial, estado operativo y acceso del cliente.
                          </p>
                        </div>
                        {formUnits.length > 1 && (
                          <button onClick={() => removeFormUnit(activeFormUnit.key)} aria-label="Quitar nodo" title="Quitar nodo" style={{ display: "flex", alignItems: "center", gap: 6, background: "white", color: "#C0392B", border: "1px solid #F5C6C2", borderRadius: 8, padding: "7px 10px", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "var(--font-sans)" }}>
                            <Trash2 size={13} strokeWidth={2} />
                            Quitar
                          </button>
                        )}
                      </div>

                      <div style={{ background: "white", border: "1px solid var(--color-mist)", borderRadius: 12, padding: 14, marginBottom: 12 }}>
                        <p style={{ margin: "0 0 12px", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-slate2)" }}>
                          Contratación
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                          <div>
                            <label style={labelStyle}>Módulo</label>
                            <FormSelect
                              {...modalSelectProps}
                              value={activeFormUnit.unit_code}
                              onChange={(newCode) => {
                                updateFormUnit(activeFormUnit.key, {
                                  unit_code: newCode,
                                  plan: defaultPlanCodeForUnit(planes, newCode),
                                });
                              }}
                              options={NODES.map((node) => ({
                                value: node.code,
                                label: node.inDevelopment ? `${node.label} (en desarrollo)` : node.label,
                                disabled: formUnits.some(
                                  (unit) => unit.key !== activeFormUnit.key && unit.unit_code === node.code,
                                ),
                              }))}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Plan</label>
                            {(() => {
                              const planOptions = getPlanSelectOptions(planes, activeFormUnit.unit_code);
                              if (planOptions.length > 0) {
                                return (
                                  <FormSelect
                                    {...modalSelectProps}
                                    value={activeFormUnit.plan}
                                    onChange={(value) => updateFormUnit(activeFormUnit.key, { plan: value })}
                                    options={planOptions}
                                  />
                                );
                              }
                              return (
                                <input type="text" value={activeFormUnit.plan} onChange={(e) => updateFormUnit(activeFormUnit.key, { plan: e.target.value })} style={inputStyle} placeholder="Plan..." />
                              );
                            })()}
                          </div>
                          <div>
                            <label style={labelStyle}>Estado</label>
                            <FormSelect
                              {...modalSelectProps}
                              value={activeFormUnit.status}
                              onChange={(value) => updateFormUnit(activeFormUnit.key, { status: value as ClientStatus })}
                              options={[
                                { value: "activo", label: "Activo" },
                                { value: "pausado", label: "Pausado" },
                                { value: "pending_review", label: "Pendiente revisión" },
                                { value: "pending_onboarding", label: "Onboarding pendiente" },
                                { value: "onboarding", label: "Onboarding" },
                              ]}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Avance (%)</label>
                            <input type="number" value={activeFormUnit.progress} onChange={(e) => updateFormUnit(activeFormUnit.key, { progress: e.target.value })} style={inputStyle} min="0" max="100" />
                          </div>
                        </div>
                      </div>

                      <div style={{ background: "white", border: "1px solid var(--color-mist)", borderRadius: 12, padding: 14 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                          <div>
                            <p style={{ margin: 0, fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-slate2)" }}>
                              Acceso del cliente
                            </p>
                            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-slate2)", lineHeight: 1.45 }}>
                              La contraseña real definida por el usuario no se puede consultar. Desde acá podés definir una temporal o blanquear el acceso.
                            </p>
                          </div>
                          {activeFormUnit.provisioned_at && (
                            <span style={{ fontSize: 11.5, fontWeight: 800, background: "#E1F0E8", color: "#1F8A5B", borderRadius: 999, padding: "4px 9px", whiteSpace: "nowrap" }}>
                              Acceso activo
                            </span>
                          )}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                          <div>
                            <label style={labelStyle}>Usuario (email)</label>
                            <input type="text" value={activeFormUnit.access_user} onChange={(e) => updateFormUnit(activeFormUnit.key, { access_user: e.target.value })} style={inputStyle} autoComplete="off" />
                          </div>
                          <div>
                            <label style={labelStyle}>Contraseña temporal / inicial</label>
                            <input type="text" value={activeFormUnit.access_password} onChange={(e) => updateFormUnit(activeFormUnit.key, { access_password: e.target.value })} style={inputStyle} autoComplete="off" />
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
                          {(() => {
                            const nodeDef = NODES.find((n) => n.code === activeFormUnit.unit_code);
                            if (!unitHasClientAccessCredentials(activeFormUnit.access_user)) {
                              return (
                                <p style={{ margin: 0, fontSize: 11.5, color: "var(--color-slate2)" }}>
                                  Completá el email de acceso para gestionar credenciales en cualquier nodo.
                                </p>
                              );
                            }
                            if (!activeFormUnit.access_password.trim()) {
                              return (
                                <p style={{ margin: 0, fontSize: 11.5, color: "#B5630C", fontWeight: 600 }}>
                                  Definí una contraseña temporal o usá Blanquear para forzar cambio al ingresar.
                                </p>
                              );
                            }
                            if (activeFormUnit.status !== "activo" && activeFormUnit.status !== "onboarding") {
                              return (
                                <p style={{ margin: 0, fontSize: 11.5, color: "var(--color-slate2)" }}>
                                  El acceso se sincroniza cuando el estado está activo u onboarding.
                                </p>
                              );
                            }
                            if (nodeDef?.provisionable && activeFormUnit.provisioned_at) {
                              return (
                                <p style={{ margin: 0, fontSize: 11.5, color: "#1F8A5B", fontWeight: 600 }}>
                                  ✓ Acceso ya creado en {nodeDef.label}
                                </p>
                              );
                            }
                            if (nodeDef?.provisionable) {
                              return (
                                <p style={{ margin: 0, fontSize: 11.5, color: "#2A6FDB", fontWeight: 500 }}>
                                  Al guardar se creará o actualizará el acceso en {nodeDef.label}.
                                </p>
                              );
                            }
                            return (
                              <p style={{ margin: 0, fontSize: 11.5, color: "#2A6FDB", fontWeight: 500 }}>
                                Al guardar se actualiza la contraseña en Auth para {nodeDef?.label ?? activeFormUnit.unit_code}.
                              </p>
                            );
                          })()}
                          {editingClient && unitHasClientAccessCredentials(activeFormUnit.access_user) && (
                            <button
                              type="button"
                              onClick={() => resetUnitPassword(activeFormUnit)}
                              disabled={resettingUnitKey === activeFormUnit.key}
                              style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--color-navy)", color: "white", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: resettingUnitKey === activeFormUnit.key ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)", opacity: resettingUnitKey === activeFormUnit.key ? 0.65 : 1, flexShrink: 0 }}
                            >
                              <RotateCcw size={13} />
                              {resettingUnitKey === activeFormUnit.key ? "Blanqueando..." : "Blanquear contraseña"}
                            </button>
                          )}
                        </div>
                      </div>

                      {editingClient && activeFormUnit.provisioned_at && (
                        <div
                          style={{
                            background: "#FEF2F2",
                            border: "1px solid #FECACA",
                            borderRadius: 12,
                            padding: 14,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                            <div>
                              <p style={{ margin: 0, fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#991B1B" }}>
                                Zona peligrosa
                              </p>
                              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#7F1D1D", lineHeight: 1.45 }}>
                                Borra propiedades, contratos, contactos, pagos, caja y el resto de datos operativos de{" "}
                                {NODES.find((n) => n.code === activeFormUnit.unit_code)?.label ?? activeFormUnit.unit_code}.
                                No elimina la organización ni el usuario administrador.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setPurgeConfirmUnit(activeFormUnit);
                                setPurgeConfirmText("");
                                setPurgeConfirmPassword("");
                                setPurgeModalError("");
                              }}
                              disabled={purgingUnitKey === activeFormUnit.key}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                background: "#DC2626",
                                color: "white",
                                border: "none",
                                borderRadius: 8,
                                padding: "8px 12px",
                                fontSize: 12.5,
                                fontWeight: 700,
                                cursor: purgingUnitKey === activeFormUnit.key ? "not-allowed" : "pointer",
                                fontFamily: "var(--font-sans)",
                                opacity: purgingUnitKey === activeFormUnit.key ? 0.65 : 1,
                                flexShrink: 0,
                              }}
                            >
                              {purgingUnitKey === activeFormUnit.key ? (
                                <>
                                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                                  Borrando...
                                </>
                              ) : (
                                <>
                                  <Database size={13} />
                                  Borrar datos del nodo
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {noticeMessage && (
                  <p style={{ margin: 0, fontSize: 12.5, color: "#1F8A5B", fontWeight: 600 }}>{noticeMessage}</p>
                )}
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
