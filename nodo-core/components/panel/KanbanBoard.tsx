"use client";

import { useState, useRef, useEffect } from "react";
import { Bug, CheckSquare, Lightbulb } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Task = {
  id: string;
  title: string;
  description: string | null;
  unit_code: string;
  status: "backlog" | "doing" | "review" | "done";
  priority: "alta" | "media" | "baja";
  type: "task" | "bug" | "idea";
  assignee: string | null;
  due_date: string | null;
  position: number;
};

export type Profile = {
  id: string;
  full_name: string;
  initials: string;
  color: string;
  avatar_url?: string | null;
};

type KanbanBoardProps = {
  initialTasks: Task[];
  profiles: Profile[];
  units: string[];
  searchTerm: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: { id: Task["status"]; label: string; color: string }[] = [
  { id: "backlog", label: "Por hacer", color: "#9DACBE" },
  { id: "doing", label: "En progreso", color: "#2A6FDB" },
  { id: "review", label: "En revisión", color: "#DA5A0E" },
  { id: "done", label: "Hecho", color: "#1F8A5B" },
];

const PRIORITY_STYLES: Record<
  Task["priority"],
  { bg: string; color: string; label: string }
> = {
  alta: { bg: "#FBE6E1", color: "#C0392B", label: "Alta" },
  media: { bg: "#FCE9D8", color: "#B5630C", label: "Media" },
  baja: { bg: "var(--color-mist)", color: "var(--color-slate2)", label: "Baja" },
};

const TYPE_CONFIG: Record<Task["type"], { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  task: { label: "Tarea",  color: "#2A6FDB", bg: "#E3EDFC", Icon: CheckSquare },
  bug:  { label: "Bug",    color: "#C0392B", bg: "#FBE6E1", Icon: Bug },
  idea: { label: "Idea",   color: "#B5630C", bg: "#FCE9D8", Icon: Lightbulb },
};

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

// ─── AssigneeAvatar (photo or initials) ───────────────────────────────────────

function AssigneeAvatar({
  profile,
  size = 26,
  title,
  withInitials = false,
  ring = false,
}: {
  profile: Profile;
  size?: number;
  title?: string;
  withInitials?: boolean;
  ring?: boolean;
}) {
  const label = title ?? profile.full_name;
  const boxShadow = ring ? "0 0 0 2px var(--color-brand)" : undefined;

  const circle = profile.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={profile.avatar_url}
      alt={label}
      title={label}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        display: "block",
        boxShadow,
      }}
    />
  ) : (
    <div
      title={label}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: profile.color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.38),
        fontWeight: 700,
        color: "white",
        flexShrink: 0,
        boxShadow,
      }}
    >
      {/* No photo → always show initials inside the circle. */}
      {profile.initials}
    </div>
  );

  if (!withInitials) return circle;

  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      {circle}
      {/* Caption only when there's a photo — no-photo circles already show the
          initials inside, so a caption would just duplicate them. */}
      {profile.avatar_url && (
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            lineHeight: 1,
            color: "var(--color-slate2)",
            fontFamily: "var(--font-sans)",
          }}
        >
          {profile.initials}
        </span>
      )}
    </span>
  );
}

// ─── TaskEditModal ────────────────────────────────────────────────────────────

function TaskEditModal({
  task,
  profiles,
  units,
  onSave,
  onDelete,
  onClose,
}: {
  task: Task;
  profiles: Profile[];
  units: string[];
  onSave: (updated: Task) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [unitCode, setUnitCode] = useState(task.unit_code);
  const [priority, setPriority] = useState<Task["priority"]>(task.priority);
  const [type, setType] = useState<Task["type"]>(task.type ?? "task");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--color-mist)",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13.5,
    fontFamily: "var(--font-sans)",
    outline: "none",
    boxSizing: "border-box",
    color: "var(--color-ink)",
    background: "white",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-slate2)",
    marginBottom: 5,
    fontFamily: "var(--font-sans)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    const updated: Task = {
      ...task,
      title: title.trim(),
      description: description.trim() || null,
      unit_code: unitCode,
      priority,
      type,
      due_date: dueDate || null,
      assignee: assignee || null,
    };
    onSave(updated);
  }

  async function handleDelete() {
    onDelete(task.id);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(18,30,47,.52)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(18,30,47,.18)",
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--color-mist)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 16,
              color: "var(--color-navy)",
            }}
          >
            Editar tarea
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-slate2)",
              fontSize: 20,
              lineHeight: 1,
              padding: "2px 4px",
              borderRadius: 4,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Unidad</label>
              <select
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                style={inputStyle}
              >
                {units.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Prioridad</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Task["priority"])}
                style={inputStyle}
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Task["type"])}
                style={inputStyle}
              >
                <option value="task">Tarea</option>
                <option value="bug">Bug</option>
                <option value="idea">Idea</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Fecha límite</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Responsable</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              style={inputStyle}
            >
              <option value="">Sin asignar</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            {assignee && (() => {
              const profile = profiles.find((p) => p.id === assignee);
              if (!profile) return null;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <AssigneeAvatar profile={profile} size={28} />
                  <span style={{ fontSize: 13, color: "var(--color-ink)" }}>{profile.full_name}</span>
                </div>
              );
            })()}
          </div>
        </div>

        <div
          style={{
            padding: "16px 24px 20px",
            borderTop: "1px solid var(--color-mist)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              style={{
                flex: 1,
                background: "var(--color-brand)",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                fontFamily: "var(--font-sans)",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                background: "transparent",
                color: "var(--color-slate2)",
                border: "1px solid var(--color-mist)",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
              }}
            >
              Cancelar
            </button>
          </div>

          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                background: "transparent",
                color: "#C0392B",
                border: "1px solid #F5C6C2",
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
              }}
            >
              Eliminar tarea
            </button>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleDelete}
                style={{
                  flex: 1,
                  background: "#C0392B",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Confirmar eliminación
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  flex: 1,
                  background: "transparent",
                  color: "var(--color-slate2)",
                  border: "1px solid var(--color-mist)",
                  borderRadius: 8,
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                No, cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TaskCard (pure visual) ───────────────────────────────────────────────────

function TaskCard({
  task,
  profiles,
}: {
  task: Task;
  profiles: Profile[];
}) {
  const assignee = profiles.find((p) => p.id === task.assignee);
  const priority = PRIORITY_STYLES[task.priority];
  const typeConf = TYPE_CONFIG[task.type ?? "task"];
  const TypeIcon = typeConf.Icon;

  return (
    <div
      style={{
        background: "white",
        border: "1px solid var(--color-mist)",
        borderRadius: 8,
        padding: 14,
        marginBottom: 8,
        boxShadow: "0 1px 2px rgba(18,30,47,.06)",
        cursor: "grab",
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 11.5,
            background: "var(--color-mist-200)",
            borderRadius: 6,
            padding: "3px 8px",
            color: "var(--color-navy)",
            whiteSpace: "nowrap",
          }}
        >
          nodo | <span style={{ fontWeight: 600 }}>{task.unit_code}</span>
        </span>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            background: priority.bg,
            color: priority.color,
            borderRadius: 999,
            padding: "2px 8px",
          }}
        >
          {priority.label}
        </span>
        <span
          title={typeConf.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 6,
            background: typeConf.bg,
            color: typeConf.color,
            marginLeft: "auto",
            flexShrink: 0,
          }}
        >
          <TypeIcon size={13} strokeWidth={2.2} />
        </span>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 14.5,
          fontWeight: 600,
          color: "var(--color-ink)",
          lineHeight: 1.35,
          fontFamily: "var(--font-sans)",
          marginBottom: task.description ? 4 : 0,
        }}
      >
        {task.title}
      </p>

      {task.description && (
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: "var(--color-slate2)",
            lineHeight: 1.45,
            marginBottom: 10,
          }}
        >
          {task.description}
        </p>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 10,
        }}
      >
        {task.due_date ? (
          <span style={{ fontSize: 12, color: "var(--color-slate2)" }}>
            🗓 {formatDate(task.due_date)}
          </span>
        ) : (
          <span />
        )}
        {assignee && <AssigneeAvatar profile={assignee} size={26} withInitials />}
      </div>
    </div>
  );
}

// ─── SortableCard ─────────────────────────────────────────────────────────────

function SortableCard({
  task,
  profiles,
  onEdit,
}: {
  task: Task;
  profiles: Profile[];
  onEdit: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: "card", task } });

  const wasDragging = useRef(false);

  useEffect(() => {
    if (isDragging) wasDragging.current = true;
  }, [isDragging]);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (wasDragging.current) {
          wasDragging.current = false;
          return;
        }
        onEdit(task);
      }}
    >
      <TaskCard task={task} profiles={profiles} />
    </div>
  );
}

// ─── AddTaskForm ──────────────────────────────────────────────────────────────

function AddTaskForm({
  status,
  units,
  onAdd,
  onCancel,
}: {
  status: Task["status"];
  units: string[];
  onAdd: (task: Omit<Task, "id" | "position">) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState(units[0] ?? "");
  const [priority, setPriority] = useState<Task["priority"]>("media");
  const [type, setType] = useState<Task["type"]>("task");

  function handleSubmit() {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), description: null, unit_code: unit, status, priority, type, assignee: null, due_date: null });
  }

  return (
    <div style={{ background: "white", border: "1px solid var(--color-mist)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <textarea
        autoFocus
        placeholder="Título de la tarea..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        rows={2}
        style={{
          width: "100%", border: "1px solid var(--color-mist)", borderRadius: 6,
          padding: "6px 10px", fontSize: 13.5, fontFamily: "var(--font-sans)",
          resize: "none", outline: "none", marginBottom: 8, boxSizing: "border-box",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
          if (e.key === "Escape") onCancel();
        }}
      />
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          style={{ flex: 1, border: "1px solid var(--color-mist)", borderRadius: 6, padding: "5px 8px", fontSize: 12.5, fontFamily: "var(--font-sans)", outline: "none" }}
        >
          {units.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Task["priority"])}
          style={{ flex: 1, border: "1px solid var(--color-mist)", borderRadius: 6, padding: "5px 8px", fontSize: 12.5, fontFamily: "var(--font-sans)", outline: "none" }}
        >
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as Task["type"])}
          style={{ flex: 1, border: "1px solid var(--color-mist)", borderRadius: 6, padding: "5px 8px", fontSize: 12.5, fontFamily: "var(--font-sans)", outline: "none" }}
        >
          <option value="task">Tarea</option>
          <option value="bug">Bug</option>
          <option value="idea">Idea</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={handleSubmit}
          style={{ flex: 1, background: "var(--color-brand)", color: "white", border: "none", borderRadius: 6, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}
        >
          Agregar
        </button>
        <button
          onClick={onCancel}
          style={{ flex: 1, background: "transparent", color: "var(--color-slate2)", border: "1px solid var(--color-mist)", borderRadius: 6, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

function KanbanColumn({
  column,
  tasks,
  profiles,
  units,
  isOver,
  onAddTask,
  onEditTask,
}: {
  column: (typeof COLUMNS)[number];
  tasks: Task[];
  profiles: Profile[];
  units: string[];
  isOver: boolean;
  onAddTask: (task: Omit<Task, "id" | "position">) => void;
  onEditTask: (task: Task) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const { setNodeRef: setDropRef } = useDroppable({ id: column.id });

  return (
    <div
      ref={setDropRef}
      style={{
        background: isOver ? "#E2EBF4" : "#EEF3F8",
        border: "1px solid var(--color-mist)",
        borderRadius: 10,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        minHeight: 200,
        boxShadow: isOver ? "inset 0 0 0 2px var(--color-brand)" : "none",
        transition: "background 150ms, box-shadow 150ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <div style={{ width: 9, height: 9, borderRadius: "50%", background: column.color, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-navy)", fontFamily: "var(--font-display)", flex: 1 }}>
          {column.label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, background: "rgba(27,42,65,.1)", borderRadius: 999, padding: "2px 8px", color: "var(--color-navy)" }}>
          {tasks.length}
        </span>
      </div>

      {showForm ? (
        <AddTaskForm
          status={column.id}
          units={units}
          onAdd={(task) => { onAddTask(task); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: 8,
            border: "1.5px dashed var(--color-slate2-300)", background: "transparent",
            color: "var(--color-slate2)", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "var(--font-sans)", marginBottom: 10,
            transition: "border-color 150ms, color 150ms, background 150ms",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = "var(--color-brand)";
            el.style.color = "var(--color-brand)";
            el.style.background = "white";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = "var(--color-slate2-300)";
            el.style.color = "var(--color-slate2)";
            el.style.background = "transparent";
          }}
        >
          + Agregar tarea
        </button>
      )}

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div style={{ flex: 1, minHeight: 40 }}>
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} profiles={profiles} onEdit={onEditTask} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

function FilterBar({
  profiles,
  units,
  selectedAssignees,
  selectedUnits,
  selectedTypes,
  onToggleAssignee,
  onToggleUnit,
  onToggleType,
  onClearAll,
}: {
  profiles: Profile[];
  units: string[];
  selectedAssignees: string[];
  selectedUnits: string[];
  selectedTypes: Task["type"][];
  onToggleAssignee: (id: string) => void;
  onToggleUnit: (unit: string) => void;
  onToggleType: (type: Task["type"]) => void;
  onClearAll: () => void;
}) {
  const hasFilters = selectedAssignees.length > 0 || selectedUnits.length > 0 || selectedTypes.length > 0;

  const chipBase: React.CSSProperties = {
    border: "1px solid var(--color-mist)",
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    transition: "background 150ms, color 150ms, border-color 150ms",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
      {/* Assignees */}
      {profiles.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-slate2)", textTransform: "uppercase", letterSpacing: "0.05em", width: 90, flexShrink: 0 }}>Responsable</span>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            {profiles.map((p) => {
              const active = selectedAssignees.includes(p.id);
              const dimmed = selectedAssignees.length > 0 && !active;
              return (
                <button key={p.id} type="button" onClick={() => onToggleAssignee(p.id)} title={p.full_name} aria-pressed={active}
                  style={{ padding: 0, border: "none", background: "transparent", cursor: "pointer", opacity: dimmed ? 0.35 : 1, transform: active ? "translateY(-3px)" : "none", transition: "opacity 150ms, transform 150ms", borderRadius: 8 }}>
                  <AssigneeAvatar profile={p} size={30} withInitials ring={active} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Units */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-slate2)", textTransform: "uppercase", letterSpacing: "0.05em", width: 90, flexShrink: 0 }}>Unidad</span>
        {units.map((u) => {
          const active = selectedUnits.includes(u);
          return (
            <button key={u} onClick={() => onToggleUnit(u)} style={{ ...chipBase, background: active ? "var(--color-navy)" : "white", color: active ? "white" : "var(--color-slate2)", borderColor: active ? "var(--color-navy)" : "var(--color-mist)" }}>
              {u}
            </button>
          );
        })}
      </div>

      {/* Types */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-slate2)", textTransform: "uppercase", letterSpacing: "0.05em", width: 90, flexShrink: 0 }}>Tipo</span>
        {(Object.entries(TYPE_CONFIG) as [Task["type"], (typeof TYPE_CONFIG)[Task["type"]]][]).map(([key, conf]) => {
          const active = selectedTypes.includes(key);
          const Icon = conf.Icon;
          return (
            <button key={key} onClick={() => onToggleType(key)}
              style={{ ...chipBase, display: "inline-flex", alignItems: "center", gap: 5, background: active ? conf.bg : "white", color: active ? conf.color : "var(--color-slate2)", borderColor: active ? conf.color : "var(--color-mist)" }}>
              <Icon size={13} strokeWidth={2.2} />
              {conf.label}
            </button>
          );
        })}
      </div>

      {hasFilters && (
        <div>
          <button onClick={onClearAll} style={{ ...chipBase, background: "transparent", color: "var(--color-slate2)" }}>
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}

// ─── KanbanBoard (root, owns DndContext) ──────────────────────────────────────

export default function KanbanBoard({
  initialTasks,
  profiles,
  units,
  searchTerm,
}: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overColumnId, setOverColumnId] = useState<Task["status"] | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [unitFilter, setUnitFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<Task["type"][]>([]);

  function toggleAssignee(id: string) {
    setAssigneeFilter((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  }
  function toggleUnit(unit: string) {
    setUnitFilter((prev) => prev.includes(unit) ? prev.filter((u) => u !== unit) : [...prev, unit]);
  }
  function toggleType(type: Task["type"]) {
    setTypeFilter((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  }
  function clearAllFilters() {
    setAssigneeFilter([]);
    setUnitFilter([]);
    setTypeFilter([]);
  }

  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      !searchTerm ||
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesAssignee =
      assigneeFilter.length === 0 ||
      (t.assignee !== null && assigneeFilter.includes(t.assignee));
    const matchesUnit =
      unitFilter.length === 0 || unitFilter.includes(t.unit_code);
    const matchesType =
      typeFilter.length === 0 || typeFilter.includes(t.type ?? "task");
    return matchesSearch && matchesAssignee && matchesUnit && matchesType;
  });

  function getColumnTasks(status: Task["status"]) {
    return filteredTasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.position - b.position);
  }

  const columnIds = COLUMNS.map((c) => c.id as string);

  function resolveColumnId(id: string): Task["status"] | null {
    if (columnIds.includes(id)) return id as Task["status"];
    return tasks.find((t) => t.id === id)?.status ?? null;
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === (event.active.id as string));
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    if (!over) { setOverColumnId(null); return; }
    setOverColumnId(resolveColumnId(over.id as string));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    setOverColumnId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const srcTask = tasks.find((t) => t.id === activeId);
    if (!srcTask) return;

    const targetStatus = resolveColumnId(overId) ?? srcTask.status;

    setTasks((prev) => {
      let next = prev.map((t) =>
        t.id === activeId ? { ...t, status: targetStatus } : t
      );

      const colTasks = next
        .filter((t) => t.status === targetStatus)
        .sort((a, b) => a.position - b.position);

      let reordered: Task[];

      if (columnIds.includes(overId)) {
        const without = colTasks.filter((t) => t.id !== activeId);
        reordered = [...without, next.find((t) => t.id === activeId)!];
      } else {
        const fromIdx = colTasks.findIndex((t) => t.id === activeId);
        const toIdx = colTasks.findIndex((t) => t.id === overId);
        if (fromIdx !== -1 && toIdx !== -1) {
          reordered = arrayMove(colTasks, fromIdx, toIdx);
        } else if (fromIdx === -1 && toIdx !== -1) {
          const without = colTasks.filter((t) => t.id !== activeId);
          without.splice(toIdx, 0, next.find((t) => t.id === activeId)!);
          reordered = without;
        } else {
          reordered = colTasks;
        }
      }

      const posMap = new Map(reordered.map((t, i) => [t.id, i * 1000]));
      next = next.map((t) =>
        posMap.has(t.id) ? { ...t, position: posMap.get(t.id)! } : t
      );

      const updatedTask = next.find((t) => t.id === activeId)!;
      supabase
        .from("tasks")
        .update({ status: updatedTask.status, position: updatedTask.position })
        .eq("id", activeId)
        .then(({ error }) => { if (error) console.error("Error persisting task move:", error); });

      return next;
    });
  }

  async function handleAddTask(taskData: Omit<Task, "id" | "position">) {
    const colTasks = tasks
      .filter((t) => t.status === taskData.status)
      .sort((a, b) => a.position - b.position);
    const position = colTasks.length > 0 ? colTasks[colTasks.length - 1].position + 1000 : 0;

    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...taskData, position })
      .select()
      .single();

    if (error) { console.error("Error adding task:", error); return; }
    if (data) setTasks((prev) => [...prev, data as Task]);
  }

  async function handleSaveTask(updated: Task) {
    const { error } = await supabase
      .from("tasks")
      .update({
        title: updated.title,
        description: updated.description,
        unit_code: updated.unit_code,
        priority: updated.priority,
        type: updated.type,
        due_date: updated.due_date,
        assignee: updated.assignee,
      })
      .eq("id", updated.id);

    if (error) { console.error("Error saving task:", error); return; }
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditingTask(null);
  }

  async function handleDeleteTask(id: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { console.error("Error deleting task:", error); return; }
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setEditingTask(null);
  }

  const completedCount = tasks.filter((t) => t.status === "done").length;
  const totalCount = tasks.length;
  const completedPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          profiles={profiles}
          units={units}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => setEditingTask(null)}
        />
      )}

      <div
        style={{
          background: "linear-gradient(135deg, var(--color-navy) 0%, var(--color-navy-700) 100%)",
          borderRadius: 10,
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ color: "white", fontSize: 17, margin: 0, marginBottom: 4 }}>
            El Core está en construcción 🚧
          </h3>
          <p style={{ margin: 0, color: "rgba(234,240,247,.74)", fontSize: 13.5, lineHeight: 1.5 }}>
            Este tablero es el roadmap vivo del equipo. Arrastre las tarjetas entre columnas para actualizar el estado de cada tarea del núcleo de negocio.
          </p>
        </div>
        <span
          style={{
            background: "rgba(255,255,255,.12)",
            color: "white",
            borderRadius: 999,
            padding: "6px 16px",
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {completedCount} de {totalCount} completadas · {completedPct}%
        </span>
      </div>

      <div
        className="panel-stats"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {[
          { label: "Total de tareas", value: totalCount },
          { label: "En curso", value: tasks.filter((t) => t.status === "doing").length },
          { label: "En revisión", value: tasks.filter((t) => t.status === "review").length },
          { label: "Completadas", value: completedCount },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "white",
              border: "1px solid var(--color-mist)",
              borderRadius: 10,
              padding: "18px 20px",
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: "var(--color-slate2)", fontWeight: 500, marginBottom: 6 }}>
              {stat.label}
            </p>
            <p style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, color: "var(--color-navy)" }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <FilterBar
        profiles={profiles}
        units={units}
        selectedAssignees={assigneeFilter}
        selectedUnits={unitFilter}
        selectedTypes={typeFilter}
        onToggleAssignee={toggleAssignee}
        onToggleUnit={toggleUnit}
        onToggleType={toggleType}
        onClearAll={clearAllFilters}
      />

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          className="kanban-board"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(206px, 1fr))",
            gap: 16,
          }}
        >
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={getColumnTasks(column.id)}
              profiles={profiles}
              units={units}
              isOver={overColumnId === column.id}
              onAddTask={handleAddTask}
              onEditTask={setEditingTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div style={{ transform: "rotate(1.5deg)", cursor: "grabbing" }}>
              <TaskCard task={activeTask} profiles={profiles} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
