"use client";

import { useState, useEffect } from "react";
import { Pencil, Trash2, ArrowRightCircle } from "lucide-react";
import Topbar from "@/components/panel/Topbar";
import { createClient } from "@/lib/supabase/client";
import { NODES } from "@/lib/nodes";

type IdeaArea = "desarrollo" | "marketing" | "negocio" | "operaciones" | "otro";
type IdeaStatus = "nueva" | "debate" | "aprobada" | "descartada";

type Idea = {
  id: string;
  title: string;
  description: string | null;
  area: IdeaArea;
  status: IdeaStatus;
  created_by: string | null;
  promoted_task_id: string | null;
  created_at: string;
};

type Member = {
  id: string;
  full_name: string;
  initials: string;
  color: string;
};

const AREAS: { value: IdeaArea; label: string; color: string }[] = [
  { value: "desarrollo", label: "Desarrollo", color: "#2A6FDB" },
  { value: "marketing", label: "Marketing", color: "#DB2777" },
  { value: "negocio", label: "Negocio", color: "#1F8A5B" },
  { value: "operaciones", label: "Operaciones", color: "#7C3AED" },
  { value: "otro", label: "Otro", color: "#64748B" },
];

const AREA_BY_VALUE = new Map(AREAS.map((a) => [a.value, a]));

const STATUSES: { value: IdeaStatus; label: string; bg: string; color: string }[] = [
  { value: "nueva", label: "Nueva", bg: "#E6EEFB", color: "#2A6FDB" },
  { value: "debate", label: "En debate", bg: "#FCE9D8", color: "#B5630C" },
  { value: "aprobada", label: "Aprobada", bg: "#E1F0E8", color: "#1F8A5B" },
  { value: "descartada", label: "Descartada", bg: "var(--color-mist)", color: "var(--color-slate2)" },
];

const STATUS_BY_VALUE = new Map(STATUSES.map((s) => [s.value, s]));

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [areaFilter, setAreaFilter] = useState<IdeaArea | "all">("all");

  const [showForm, setShowForm] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Idea | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formArea, setFormArea] = useState<IdeaArea>("desarrollo");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const supabase = createClient();
    const [{ data: { user } }, { data: profs }, { data: rows }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("profiles").select("id, full_name, initials, color").order("created_at"),
      supabase.from("ideas").select("*").order("created_at", { ascending: false }),
    ]);
    setUserId(user?.id ?? null);
    setMembers((profs ?? []) as Member[]);
    setIdeas((rows ?? []) as Idea[]);
    setLoading(false);
  }

  const memberById = new Map(members.map((m) => [m.id, m]));

  const filtered = ideas.filter((i) => {
    if (areaFilter !== "all" && i.area !== areaFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      i.title.toLowerCase().includes(term) ||
      (i.description?.toLowerCase().includes(term) ?? false)
    );
  });

  function openAddForm() {
    setEditingIdea(null);
    setFormTitle("");
    setFormDescription("");
    setFormArea("desarrollo");
    setError("");
    setShowForm(true);
  }

  function openEditForm(idea: Idea) {
    setEditingIdea(idea);
    setFormTitle(idea.title);
    setFormDescription(idea.description ?? "");
    setFormArea(idea.area);
    setError("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!formTitle.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();

    if (editingIdea) {
      const { error: err } = await supabase
        .from("ideas")
        .update({
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          area: formArea,
        })
        .eq("id", editingIdea.id);
      if (err) {
        setError("Error al actualizar la idea: " + err.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: err } = await supabase.from("ideas").insert({
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        area: formArea,
        status: "nueva",
        created_by: userId,
      });
      if (err) {
        setError("Error al crear la idea: " + err.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowForm(false);
    loadAll();
  }

  async function changeStatus(idea: Idea, status: IdeaStatus) {
    const supabase = createClient();
    setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, status } : i)));
    await supabase.from("ideas").update({ status }).eq("id", idea.id);
  }

  async function performDelete() {
    if (!confirmDelete) return;
    const supabase = createClient();
    await supabase.from("ideas").delete().eq("id", confirmDelete.id);
    setIdeas((prev) => prev.filter((i) => i.id !== confirmDelete.id));
    setConfirmDelete(null);
  }

  async function promoteToTask(idea: Idea) {
    const supabase = createClient();
    // Append to the end of the "backlog" column.
    const { data: last } = await supabase
      .from("tasks")
      .select("position")
      .eq("status", "backlog")
      .order("position", { ascending: false })
      .limit(1);
    const position = last && last[0] ? last[0].position + 1000 : 0;

    const { data: task, error: err } = await supabase
      .from("tasks")
      .insert({
        title: idea.title,
        description: idea.description,
        unit_code: NODES[0]?.code ?? "Core",
        status: "backlog",
        priority: "media",
        assignee: null,
        due_date: null,
        position,
      })
      .select()
      .single();

    if (err || !task) {
      setError("Error al convertir en tarea: " + (err?.message ?? ""));
      return;
    }

    await supabase
      .from("ideas")
      .update({ status: "aprobada", promoted_task_id: task.id })
      .eq("id", idea.id);

    setIdeas((prev) =>
      prev.map((i) =>
        i.id === idea.id ? { ...i, status: "aprobada", promoted_task_id: task.id } : i
      )
    );
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

  return (
    <>
      <Topbar
        breadcrumb="Nodo Core · Gestión"
        title="Ideas"
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar ideas..."
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
        {/* Header + add */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          {/* Area filter chips */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[{ value: "all" as const, label: "Todas", color: "var(--color-slate2)" }, ...AREAS].map((a) => {
              const active = areaFilter === a.value;
              return (
                <button
                  key={a.value}
                  onClick={() => setAreaFilter(a.value as IdeaArea | "all")}
                  style={{
                    border: `1px solid ${active ? a.color : "var(--color-mist)"}`,
                    background: active ? a.color : "white",
                    color: active ? "white" : "var(--color-slate2)",
                    borderRadius: 999,
                    padding: "5px 14px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={openAddForm}
            style={{
              background: "var(--color-brand)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "9px 18px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            + Nueva idea
          </button>
        </div>

        {/* Ideas grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--color-slate2)", fontSize: 14 }}>
            Cargando ideas...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--color-slate2)", fontSize: 14 }}>
            No hay ideas todavía. ¡Tirá la primera!
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {filtered.map((idea) => {
              const area = AREA_BY_VALUE.get(idea.area) ?? AREAS[4];
              const status = STATUS_BY_VALUE.get(idea.status) ?? STATUSES[0];
              const author = idea.created_by ? memberById.get(idea.created_by) : null;
              const promoted = !!idea.promoted_task_id;
              return (
                <div
                  key={idea.id}
                  style={{
                    background: "white",
                    border: "1px solid var(--color-mist)",
                    borderRadius: 12,
                    padding: 18,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    borderTop: `3px solid ${area.color}`,
                  }}
                >
                  {/* Badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: area.color, background: `${area.color}1A`, borderRadius: 999, padding: "3px 10px" }}>
                      {area.label}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: status.color, background: status.bg, borderRadius: 999, padding: "3px 10px" }}>
                      {status.label}
                    </span>
                    {promoted && (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-slate2)", marginLeft: "auto" }}>
                        → en tareas
                      </span>
                    )}
                  </div>

                  {/* Title + description */}
                  <div>
                    <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--color-navy)", fontFamily: "var(--font-display)" }}>
                      {idea.title}
                    </p>
                    {idea.description && (
                      <p style={{ margin: "5px 0 0", fontSize: 13.5, color: "var(--color-slate2)", lineHeight: 1.45 }}>
                        {idea.description}
                      </p>
                    )}
                  </div>

                  {/* Author + date */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {author && (
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: author.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white" }}>
                        {author.initials}
                      </div>
                    )}
                    <span style={{ fontSize: 12, color: "var(--color-slate2)" }}>
                      {author?.full_name ?? "—"} · {formatDate(idea.created_at)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, paddingTop: 12, borderTop: "1px solid var(--color-mist)" }}>
                    <select
                      value={idea.status}
                      onChange={(e) => changeStatus(idea, e.target.value as IdeaStatus)}
                      style={{ ...inputStyle, width: "auto", flex: 1, padding: "6px 8px", fontSize: 12.5 }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>

                    {!promoted && (
                      <button
                        onClick={() => promoteToTask(idea)}
                        aria-label="Convertir en tarea"
                        title="Convertir en tarea"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, height: 32, padding: "0 10px", background: "transparent", color: "#1F8A5B", border: "1px solid #A6D9BE", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}
                      >
                        <ArrowRightCircle size={15} strokeWidth={2} />
                        Tarea
                      </button>
                    )}

                    <button
                      onClick={() => openEditForm(idea)}
                      aria-label="Editar idea"
                      title="Editar"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, background: "transparent", color: "#2A6FDB", border: "1px solid #AFC6F0", borderRadius: 6, cursor: "pointer" }}
                    >
                      <Pencil size={15} strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(idea)}
                      aria-label="Eliminar idea"
                      title="Eliminar"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, background: "transparent", color: "#C0392B", border: "1px solid #F5C6C2", borderRadius: 6, cursor: "pointer" }}
                    >
                      <Trash2 size={15} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Delete confirmation modal */}
        {confirmDelete && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(18,30,47,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: 16 }}>
            <div style={{ background: "white", borderRadius: 12, width: "min(380px, 96vw)", boxShadow: "0 12px 40px rgba(18,30,47,.18)", padding: 24 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-navy)", fontFamily: "var(--font-display)" }}>
                Eliminar idea
              </h3>
              <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--color-slate2)", lineHeight: 1.5 }}>
                ¿Seguro que querés eliminar <strong style={{ color: "var(--color-ink)" }}>{confirmDelete.title}</strong>? Esta acción no se puede deshacer.
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={performDelete} style={{ flex: 1, background: "#C0392B", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                  Eliminar
                </button>
                <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, background: "transparent", color: "var(--color-slate2)", border: "1px solid var(--color-mist)", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form modal */}
        {showForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(18,30,47,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
            <div style={{ background: "white", borderRadius: 12, width: "min(460px, 96vw)", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(18,30,47,.18)" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--color-mist)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "white" }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--color-navy)", fontFamily: "var(--font-display)" }}>
                  {editingIdea ? "Editar idea" : "Nueva idea"}
                </h3>
                <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-slate2)", fontSize: 20, lineHeight: 1, padding: "2px 4px" }}>
                  ×
                </button>
              </div>

              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Título</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    style={inputStyle}
                    placeholder="Ej: Campanita de notificaciones en el board"
                  />
                </div>

                <div>
                  <label style={labelStyle}>Descripción</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                    placeholder="Contá la idea, el contexto, por qué sumaría..."
                  />
                </div>

                <div>
                  <label style={labelStyle}>Campo de acción</label>
                  <select value={formArea} onChange={(e) => setFormArea(e.target.value as IdeaArea)} style={inputStyle}>
                    {AREAS.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>

                {error && <p style={{ margin: 0, fontSize: 12.5, color: "#C0392B" }}>{error}</p>}

                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{ flex: 1, background: "var(--color-brand)", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)", opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? "Guardando..." : editingIdea ? "Guardar cambios" : "Crear idea"}
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    style={{ flex: 1, background: "transparent", color: "var(--color-slate2)", border: "1px solid var(--color-mist)", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}
                  >
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
