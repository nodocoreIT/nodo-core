"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  Bug,
  Check,
  CheckSquare,
  ChevronDown,
  Copy,
  Lightbulb,
  Plus,
  Search,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import {
  foldForSearch,
  FormSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nodocore/shared-components";
import { ECOMMERCE_ACCENT, getNodeAccentByCode } from "@/lib/node-accents";
import {
  buildTaskBranchName,
  formatTaskDescription,
  getTaskPrefixForUnit,
} from "@/lib/panel/task-code";
import {
  ALLOWED_EVIDENCE_MIME,
  createTaskComment,
} from "@/lib/panel/task-comments";
import { GenerateTitleFromDescriptionButton } from "@/components/panel/generate-title-button";
import { TaskCommentsSection } from "@/components/panel/task-comments-section";
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
  type: "task" | "bug" | "idea" | "debt" | "known_issue";
  assignee: string | null;
  due_date: string | null;
  created_at: string;
  position: number;
  created_by: string | null;
};

export const TASK_TYPES: Task["type"][] = [
  "task",
  "bug",
  "idea",
  "debt",
  "known_issue",
];

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
  onSearchChange: (value: string) => void;
};

/** Select menus portal above Kanban modals (zIndex 1000). */
const MODAL_SELECT_Z = "z-[1100]";

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

const TYPE_CONFIG: Record<
  Task["type"],
  { label: string; color: string; bg: string; Icon: React.ElementType }
> = {
  task: { label: "Tarea", color: "#2A6FDB", bg: "#E3EDFC", Icon: CheckSquare },
  bug: { label: "Bug", color: "#C0392B", bg: "#FBE6E1", Icon: Bug },
  idea: { label: "Idea", color: "#B5630C", bg: "#FCE9D8", Icon: Lightbulb },
  debt: {
    label: "Deuda técnica",
    color: "#6D28D9",
    bg: "#EDE9FE",
    Icon: Wrench,
  },
  known_issue: {
    label: "Known issue",
    color: "#B45309",
    bg: "#FEF3C7",
    Icon: AlertTriangle,
  },
};

function getTypeConfig(type: Task["type"] | string | null | undefined) {
  if (type && type in TYPE_CONFIG) {
    return TYPE_CONFIG[type as Task["type"]];
  }
  return TYPE_CONFIG.task;
}

function TaskTypeSelect({
  value,
  onChange,
  className,
  contentClassName,
}: {
  value: Task["type"];
  onChange: (value: Task["type"]) => void;
  className?: string;
  contentClassName?: string;
}) {
  const selected = getTypeConfig(value);
  const SelectedIcon = selected.Icon;

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as Task["type"])}
    >
      <SelectTrigger className={["rounded-md", className].filter(Boolean).join(" ")}>
        {/* div (not span): SelectTrigger applies [&>span]:line-clamp-1 which stacks icon/label */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <SelectedIcon
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: selected.color, flexShrink: 0 }}
            strokeWidth={2.2}
            aria-hidden
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selected.label}
          </span>
        </div>
        {/* Radix requires SelectValue; hide mirrored item content (avoids double icon) */}
        <div
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent className={["z-[200]", contentClassName].filter(Boolean).join(" ")}>
        {TASK_TYPES.map((key) => {
          const conf = TYPE_CONFIG[key];
          const Icon = conf.Icon;
          return (
            <SelectItem key={key} value={key} textValue={conf.label}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Icon
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: conf.color, flexShrink: 0 }}
                  strokeWidth={2.2}
                  aria-hidden
                />
                <span>{conf.label}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

/** Local calendar date as YYYY-MM-DD (for `<input type="date">`). */
function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateInputValue(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return todayLocalDate();
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate;
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return todayLocalDate();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Noon UTC keeps the calendar day stable across AR/UTC when saving created_at. */
function dateInputToCreatedAt(dateInput: string): string {
  return `${dateInput}T12:00:00.000Z`;
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

// ─── AssigneePicker (Jira-style: avatar-only trigger, searchable popover) ──────

function AssigneePicker({
  profiles,
  value,
  onChange,
  size = 28,
}: {
  profiles: Profile[];
  value: string;
  onChange: (value: string) => void;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = profiles.find((p) => p.id === value) ?? null;
  const filtered = search.trim()
    ? profiles.filter((p) => foldForSearch(p.full_name).includes(foldForSearch(search)))
    : profiles;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  function select(id: string) {
    onChange(id);
    setOpen(false);
    setSearch("");
  }

  const rowStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    border: "none",
    background: active ? "var(--color-paper)" : "transparent",
    padding: "6px 8px",
    borderRadius: 6,
    cursor: "pointer",
    textAlign: "left",
    fontSize: 13,
    color: "var(--color-ink)",
    fontFamily: "var(--font-sans)",
  });

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={selected ? selected.full_name : "Sin asignar"}
        style={{
          border: "1px solid var(--color-mist)",
          background: "white",
          padding: 2,
          cursor: "pointer",
          borderRadius: "50%",
          display: "flex",
        }}
      >
        {selected ? (
          <AssigneeAvatar profile={selected} size={size} />
        ) : (
          <div
            style={{
              width: size,
              height: size,
              borderRadius: "50%",
              background: "var(--color-mist)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-slate2)",
              flexShrink: 0,
            }}
          >
            <UserRound size={Math.round(size * 0.58)} />
          </div>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 1150,
            top: "100%",
            left: 0,
            marginTop: 4,
            width: 220,
            borderRadius: 8,
            border: "1px solid var(--color-mist)",
            background: "white",
            boxShadow: "0 8px 24px rgba(18,30,47,.18)",
            overflow: "hidden",
          }}
        >
          <div style={{ borderBottom: "1px solid var(--color-mist)", padding: "6px 8px" }}>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                fontSize: 13,
                fontFamily: "var(--font-sans)",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ maxHeight: 224, overflowY: "auto", padding: 4 }}>
            <button type="button" onClick={() => select("")} style={rowStyle(!value)}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--color-mist)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-slate2)",
                  flexShrink: 0,
                }}
              >
                <UserRound size={13} />
              </div>
              Sin asignar
            </button>
            {filtered.length === 0 ? (
              <p style={{ margin: 0, padding: "10px 8px", fontSize: 12.5, color: "var(--color-slate2)" }}>
                Sin resultados
              </p>
            ) : (
              filtered.map((p) => (
                <button key={p.id} type="button" onClick={() => select(p.id)} style={rowStyle(p.id === value)}>
                  <AssigneeAvatar profile={p} size={22} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.full_name}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pasted evidence (description field) ───────────────────────────────────────

type PendingEvidence = { id: string; file: File; previewUrl: string };

/** Ctrl+V a screenshot or short screen recording straight into a description. */
function useDescriptionEvidence() {
  const [pending, setPending] = useState<PendingEvidence[]>([]);

  function addFromClipboard(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
      ALLOWED_EVIDENCE_MIME.has(f.type),
    );
    if (files.length === 0) return;
    e.preventDefault();
    setPending((prev) =>
      [
        ...prev,
        ...files.map((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ].slice(0, 8),
    );
  }

  function remove(id: string) {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function reset() {
    setPending((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.previewUrl);
      return [];
    });
  }

  return { pending, addFromClipboard, remove, reset };
}

function PendingEvidenceRow({
  items,
  onRemove,
}: {
  items: PendingEvidence[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            position: "relative",
            width: 56,
            height: 56,
            borderRadius: 6,
            overflow: "hidden",
            border: "1px solid var(--color-mist)",
          }}
        >
          {item.file.type.startsWith("video/") ? (
            <video
              src={item.previewUrl}
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.previewUrl}
              alt={item.file.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "none",
              background: "rgba(0,0,0,.55)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
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
  onSave: (updated: Task) => Promise<string | null> | string | null | void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [unitCode, setUnitCode] = useState(task.unit_code);
  const [priority, setPriority] = useState<Task["priority"]>(task.priority);
  const [type, setType] = useState<Task["type"]>(task.type ?? "task");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [createdDate, setCreatedDate] = useState(toDateInputValue(task.created_at));
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [branchCopied, setBranchCopied] = useState(false);
  const evidence = useDescriptionEvidence();

  const unitOptions = useMemo(() => {
    const codes = [...units];
    if (unitCode && !codes.includes(unitCode)) codes.unshift(unitCode);
    return codes.map((unit) => ({ value: unit, label: unit }));
  }, [units, unitCode]);

  const reporter = profiles.find((p) => p.id === task.created_by);
  const branchName = title.trim() ? buildTaskBranchName(unitCode, title) : "";

  function handleCopyBranchName() {
    if (!branchName) return;
    void navigator.clipboard.writeText(branchName);
    setBranchCopied(true);
    setTimeout(() => setBranchCopied(false), 1500);
  }

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
    if (!title.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    const normalizedDescription = formatTaskDescription(description);
    if (normalizedDescription && normalizedDescription !== description) {
      setDescription(normalizedDescription);
    }
    const updated: Task = {
      ...task,
      title: title.trim(),
      description: normalizedDescription,
      unit_code: unitCode,
      priority,
      type,
      due_date: dueDate || null,
      created_at: createdDate ? dateInputToCreatedAt(createdDate) : task.created_at,
      assignee: assignee || null,
    };
    try {
      const err = await onSave(updated);
      if (err) {
        setSaveError(err);
        return;
      }
      if (evidence.pending.length > 0) {
        try {
          await createTaskComment({
            taskId: task.id,
            body: "",
            files: evidence.pending.map((p) => p.file),
          });
        } catch (attachErr) {
          console.error("Error attaching description evidence:", attachErr);
        }
        evidence.reset();
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "No se pudo guardar la tarea.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    onDelete(task.id);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(18,30,47,.52)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(18,30,47,.18)",
          width: "100%",
          maxWidth: 760,
          maxHeight: "96vh",
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

        <div style={{ padding: "16px 24px", display: "flex", gap: 24, flexWrap: "wrap" }}>
          {/* ── Columna principal: descripción, título, comentarios ──────── */}
          <div style={{ flex: "1 1 380px", minWidth: 280, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onPaste={evidence.addFromClipboard}
                rows={8}
                placeholder="Pegá una captura o video con Ctrl+V"
                style={{ ...inputStyle, resize: "vertical" }}
              />
              <PendingEvidenceRow items={evidence.pending} onRemove={evidence.remove} />
              <GenerateTitleFromDescriptionButton
                description={description}
                unitCode={unitCode}
                onTitle={setTitle}
                onDescriptionNormalized={setDescription}
              />
            </div>

            <div>
              <label style={labelStyle}>Título</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={inputStyle}
              />
            </div>

            {saveError ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 12.5,
                  color: "#b91c1c",
                  fontFamily: "var(--font-sans)",
                  lineHeight: 1.4,
                }}
              >
                {saveError}
              </p>
            ) : null}

            <TaskCommentsSection taskId={task.id} profiles={profiles} />
          </div>

          {/* ── Sidebar: metadata al estilo Jira ─────────────────────────── */}
          <div style={{ flex: "0 1 220px", minWidth: 200, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Unidad</label>
              <FormSelect
                value={unitCode}
                onChange={setUnitCode}
                options={unitOptions}
                contentClassName={MODAL_SELECT_Z}
              />
            </div>

            <div>
              <label style={labelStyle}>Prioridad</label>
              <FormSelect
                value={priority}
                onChange={(value) => setPriority(value as Task["priority"])}
                options={[
                  { value: "alta", label: "Alta" },
                  { value: "media", label: "Media" },
                  { value: "baja", label: "Baja" },
                ]}
                contentClassName={MODAL_SELECT_Z}
              />
            </div>

            <div>
              <label style={labelStyle}>Tipo</label>
              <TaskTypeSelect
                value={type}
                onChange={setType}
                contentClassName={MODAL_SELECT_Z}
              />
            </div>

            <div>
              <label style={labelStyle}>Asignado a</label>
              <AssigneePicker profiles={profiles} value={assignee} onChange={setAssignee} />
            </div>

            <div>
              <label style={labelStyle}>Reporter</label>
              {reporter ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <AssigneeAvatar profile={reporter} size={24} />
                  <span style={{ fontSize: 13, color: "var(--color-ink)" }}>{reporter.full_name}</span>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-slate2)" }}>—</p>
              )}
            </div>

            <div>
              <label style={labelStyle}>Fecha de creación</label>
              <input
                type="date"
                value={createdDate}
                onChange={(e) => setCreatedDate(e.target.value)}
                style={inputStyle}
              />
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
              <label style={labelStyle}>Branch name</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  border: "1px solid var(--color-mist)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  background: "var(--color-paper)",
                }}
              >
                <code
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 11.5,
                    fontFamily: "var(--font-mono, monospace)",
                    color: branchName ? "var(--color-ink)" : "var(--color-slate2)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={branchName || undefined}
                >
                  {branchName || `${getTaskPrefixForUnit(unitCode)}-…`}
                </code>
                <button
                  type="button"
                  onClick={handleCopyBranchName}
                  disabled={!branchName}
                  title="Copiar nombre de rama"
                  style={{
                    flexShrink: 0,
                    border: "none",
                    background: "transparent",
                    cursor: branchName ? "pointer" : "not-allowed",
                    color: branchCopied ? "#1F8A5B" : "var(--color-slate2)",
                    padding: 2,
                    display: "flex",
                  }}
                >
                  {branchCopied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
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
        </div>
      </div>

      {confirmDelete && (
        <div
          onClick={() => setConfirmDelete(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(18,30,47,.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(18,30,47,.25)",
              width: "100%",
              maxWidth: 360,
              padding: 24,
            }}
          >
            <h3
              style={{
                margin: "0 0 8px",
                fontSize: 16,
                fontWeight: 700,
                color: "var(--color-navy)",
                fontFamily: "var(--font-display)",
              }}
            >
              ¿Eliminar esta tarea?
            </h3>
            <p
              style={{
                margin: "0 0 20px",
                fontSize: 13.5,
                color: "var(--color-slate2)",
                lineHeight: 1.4,
                fontFamily: "var(--font-sans)",
              }}
            >
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleDelete}
                style={{
                  flex: 1,
                  background: "#C0392B",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 16px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                Eliminar
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
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
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TaskCreateModal ──────────────────────────────────────────────────────────

function TaskCreateModal({
  profiles,
  units,
  currentUserId,
  onCreate,
  onClose,
}: {
  profiles: Profile[];
  units: string[];
  currentUserId: string | null;
  onCreate: (task: Omit<Task, "id" | "position" | "created_by">) => Promise<Task | undefined>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitCode, setUnitCode] = useState(units[0] ?? "");
  const [priority, setPriority] = useState<Task["priority"]>("media");
  const [type, setType] = useState<Task["type"]>("task");
  const [createdDate, setCreatedDate] = useState(todayLocalDate);
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState("");
  const [saving, setSaving] = useState(false);
  const [branchCopied, setBranchCopied] = useState(false);
  const evidence = useDescriptionEvidence();

  const reporter = profiles.find((p) => p.id === currentUserId);

  const branchName = title.trim() ? buildTaskBranchName(unitCode, title) : "";

  function handleCopyBranchName() {
    if (!branchName) return;
    void navigator.clipboard.writeText(branchName);
    setBranchCopied(true);
    setTimeout(() => setBranchCopied(false), 1500);
  }

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

  async function handleCreate() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const normalizedDescription = formatTaskDescription(description);
      if (normalizedDescription && normalizedDescription !== description) {
        setDescription(normalizedDescription);
      }
      const created = await onCreate({
        title: title.trim(),
        description: normalizedDescription,
        unit_code: unitCode,
        status: "backlog",
        priority,
        type,
        due_date: dueDate || null,
        created_at: dateInputToCreatedAt(createdDate || todayLocalDate()),
        assignee: assignee || null,
      });
      if (created && evidence.pending.length > 0) {
        try {
          await createTaskComment({
            taskId: created.id,
            body: "",
            files: evidence.pending.map((p) => p.file),
          });
        } catch (err) {
          console.error("Error attaching description evidence:", err);
        }
        evidence.reset();
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(18,30,47,.52)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 6,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(18,30,47,.18)",
          width: "100%",
          maxWidth: 760,
          maxHeight: "99vh",
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
            Nueva tarea
          </span>
          <button
            type="button"
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

        <div style={{ padding: "16px 24px", display: "flex", gap: 24, flexWrap: "wrap" }}>
          {/* ── Columna principal: descripción + título ─────────────────── */}
          <div style={{ flex: "1 1 380px", minWidth: 280, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onPaste={evidence.addFromClipboard}
                rows={8}
                placeholder="Qué hay que hacer, contexto, criterios de aceptación… (pegá una captura o video con Ctrl+V)"
                autoFocus
                style={{ ...inputStyle, resize: "vertical" }}
              />
              <PendingEvidenceRow items={evidence.pending} onRemove={evidence.remove} />
              <GenerateTitleFromDescriptionButton
                description={description}
                unitCode={unitCode}
                onTitle={setTitle}
                onDescriptionNormalized={setDescription}
              />
            </div>

            <div>
              <label style={labelStyle}>Título</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Qué hay que hacer…"
                style={inputStyle}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleCreate();
                  }
                }}
              />
            </div>
          </div>

          {/* ── Sidebar: metadata al estilo Jira ─────────────────────────── */}
          <div style={{ flex: "0 1 220px", minWidth: 200, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Unidad</label>
              <FormSelect
                value={unitCode}
                onChange={setUnitCode}
                options={units.map((unit) => ({ value: unit, label: unit }))}
                contentClassName={MODAL_SELECT_Z}
              />
            </div>

            <div>
              <label style={labelStyle}>Prioridad</label>
              <FormSelect
                value={priority}
                onChange={(value) => setPriority(value as Task["priority"])}
                options={[
                  { value: "alta", label: "Alta" },
                  { value: "media", label: "Media" },
                  { value: "baja", label: "Baja" },
                ]}
                contentClassName={MODAL_SELECT_Z}
              />
            </div>

            <div>
              <label style={labelStyle}>Tipo</label>
              <TaskTypeSelect
                value={type}
                onChange={setType}
                contentClassName={MODAL_SELECT_Z}
              />
            </div>

            <div>
              <label style={labelStyle}>Asignado a</label>
              <AssigneePicker profiles={profiles} value={assignee} onChange={setAssignee} />
            </div>

            <div>
              <label style={labelStyle}>Reporter</label>
              {reporter ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <AssigneeAvatar profile={reporter} size={24} />
                  <span style={{ fontSize: 13, color: "var(--color-ink)" }}>{reporter.full_name}</span>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-slate2)" }}>—</p>
              )}
            </div>

            <div>
              <label style={labelStyle}>Fecha de creación</label>
              <input
                type="date"
                value={createdDate}
                onChange={(e) => setCreatedDate(e.target.value)}
                style={inputStyle}
              />
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
              <label style={labelStyle}>Branch name</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  border: "1px solid var(--color-mist)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  background: "var(--color-paper)",
                }}
              >
                <code
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 11.5,
                    fontFamily: "var(--font-mono, monospace)",
                    color: branchName ? "var(--color-ink)" : "var(--color-slate2)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={branchName || undefined}
                >
                  {branchName || `${getTaskPrefixForUnit(unitCode)}-…`}
                </code>
                <button
                  type="button"
                  onClick={handleCopyBranchName}
                  disabled={!branchName}
                  title="Copiar nombre de rama"
                  style={{
                    flexShrink: 0,
                    border: "none",
                    background: "transparent",
                    cursor: branchName ? "pointer" : "not-allowed",
                    color: branchCopied ? "#1F8A5B" : "var(--color-slate2)",
                    padding: 2,
                    display: "flex",
                  }}
                >
                  {branchCopied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "16px 24px 20px",
            borderTop: "1px solid var(--color-mist)",
            display: "flex",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() => void handleCreate()}
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
              cursor: saving || !title.trim() ? "not-allowed" : "pointer",
              fontFamily: "var(--font-sans)",
              opacity: saving || !title.trim() ? 0.7 : 1,
            }}
          >
            {saving ? "Creando..." : "Crear tarea"}
          </button>
          <button
            type="button"
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
  const creator = profiles.find((p) => p.id === task.created_by);
  const priority = PRIORITY_STYLES[task.priority];
  const typeConf = getTypeConfig(task.type);
  const TypeIcon = typeConf.Icon;
  const unitAccent = getNodeAccentByCode(task.unit_code);
  const unitPillOnLight = unitAccent.brand === ECOMMERCE_ACCENT.brand;

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
            background: `rgba(${unitAccent.rgb}, 0.14)`,
            border: `1px solid rgba(${unitAccent.rgb}, 0.32)`,
            borderRadius: 6,
            padding: "3px 8px",
            color: unitPillOnLight ? unitAccent.brand600 : unitAccent.brand,
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
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {task.due_date || task.created_at ? (
            <span style={{ fontSize: 12, color: "var(--color-slate2)", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {task.created_at ? <span title="Creación">📅 {formatDate(task.created_at)}</span> : null}
              {task.due_date ? <span title="Fecha límite">🗓 {formatDate(task.due_date)}</span> : null}
            </span>
          ) : (
            <span />
          )}
          {creator && (
            <span style={{ fontSize: 11, color: "var(--color-slate2)", opacity: 0.85 }}>
              Creado por {creator.full_name}
            </span>
          )}
        </div>
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
  onAdd: (task: Omit<Task, "id" | "position" | "created_by">) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState(units[0] ?? "");
  const [priority, setPriority] = useState<Task["priority"]>("media");
  const [type, setType] = useState<Task["type"]>("task");

  function handleSubmit() {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      description: null,
      unit_code: unit,
      status,
      priority,
      type,
      assignee: null,
      due_date: null,
      created_at: dateInputToCreatedAt(todayLocalDate()),
    });
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
        <FormSelect
          value={unit}
          onChange={setUnit}
          options={units.map((unitOption) => ({ value: unitOption, label: unitOption }))}
          className="flex-1"
        />
        <FormSelect
          value={priority}
          onChange={(value) => setPriority(value as Task["priority"])}
          options={[
            { value: "alta", label: "Alta" },
            { value: "media", label: "Media" },
            { value: "baja", label: "Baja" },
          ]}
          className="flex-1"
        />
        <TaskTypeSelect
          value={type}
          onChange={setType}
          className="flex-1"
        />
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
  onAddTask: (task: Omit<Task, "id" | "position" | "created_by">) => void;
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

// ─── Filter dropdown (Jira-style) ─────────────────────────────────────────────

function FilterMenu({
  label,
  activeCount,
  children,
}: {
  label: string;
  activeCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const active = activeCount > 0;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 32,
          padding: "0 10px",
          borderRadius: 6,
          border: `1px solid ${active ? "var(--color-brand)" : "var(--color-mist)"}`,
          background: active ? "rgba(232, 93, 4, 0.08)" : "white",
          color: active ? "var(--color-brand)" : "var(--color-navy)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
        {active ? (
          <span
            style={{
              minWidth: 18,
              height: 18,
              borderRadius: 999,
              background: "var(--color-brand)",
              color: "white",
              fontSize: 11,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 5px",
            }}
          >
            {activeCount}
          </span>
        ) : null}
        <ChevronDown size={14} strokeWidth={2.2} style={{ opacity: 0.7 }} />
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 40,
            minWidth: 180,
            background: "white",
            border: "1px solid var(--color-mist)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(18,30,47,.12)",
            padding: 6,
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function FilterMenuItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        textAlign: "left",
        padding: "8px 10px",
        border: "none",
        borderRadius: 6,
        background: active ? "rgba(42, 111, 219, 0.1)" : "transparent",
        color: "var(--color-navy)",
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: `1.5px solid ${active ? "var(--color-brand)" : "var(--color-slate2)"}`,
          background: active ? "var(--color-brand)" : "white",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        {active ? "✓" : ""}
      </span>
      {children}
    </button>
  );
}

// ─── FilterBar (Jira-style single toolbar) ────────────────────────────────────

function FilterBar({
  profiles,
  units,
  selectedAssignees,
  selectedUnits,
  selectedTypes,
  searchTerm,
  onSearchChange,
  onToggleAssignee,
  onToggleUnit,
  onToggleType,
  onClearAll,
  onAddTask,
}: {
  profiles: Profile[];
  units: string[];
  selectedAssignees: string[];
  selectedUnits: string[];
  selectedTypes: Task["type"][];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onToggleAssignee: (id: string) => void;
  onToggleUnit: (unit: string) => void;
  onToggleType: (type: Task["type"]) => void;
  onClearAll: () => void;
  onAddTask: () => void;
}) {
  const hasFilters =
    selectedAssignees.length > 0 ||
    selectedUnits.length > 0 ||
    selectedTypes.length > 0 ||
    searchTerm.trim() !== "";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 20,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 32,
          width: 220,
          maxWidth: "100%",
          border: "1px solid var(--color-mist)",
          borderRadius: 6,
          background: "white",
          padding: "0 10px",
          flexShrink: 0,
        }}
      >
        <Search size={15} color="var(--color-slate2)" aria-hidden />
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar en el tablero"
          aria-label="Buscar tareas"
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 13,
            fontFamily: "var(--font-sans)",
            color: "var(--color-ink)",
          }}
        />
      </div>

      {profiles.length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", paddingLeft: 4 }}>
          {profiles.map((p, index) => {
            const active = selectedAssignees.includes(p.id);
            const dimmed = selectedAssignees.length > 0 && !active;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onToggleAssignee(p.id)}
                title={p.full_name}
                aria-pressed={active}
                style={{
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  marginLeft: index === 0 ? 0 : -8,
                  zIndex: active ? 20 : profiles.length - index,
                  opacity: dimmed ? 0.4 : 1,
                  transition: "opacity 150ms, transform 150ms",
                  transform: active ? "translateY(-2px)" : "none",
                  borderRadius: "50%",
                }}
              >
                <AssigneeAvatar profile={p} size={28} ring={active} />
              </button>
            );
          })}
        </div>
      ) : null}

      <FilterMenu label="Unidad" activeCount={selectedUnits.length}>
        {units.map((u) => (
          <FilterMenuItem
            key={u}
            active={selectedUnits.includes(u)}
            onClick={() => onToggleUnit(u)}
          >
            {u}
          </FilterMenuItem>
        ))}
      </FilterMenu>

      <FilterMenu label="Tipo" activeCount={selectedTypes.length}>
        {(Object.entries(TYPE_CONFIG) as [Task["type"], (typeof TYPE_CONFIG)[Task["type"]]][]).map(
          ([key, conf]) => {
            const Icon = conf.Icon;
            return (
              <FilterMenuItem
                key={key}
                active={selectedTypes.includes(key)}
                onClick={() => onToggleType(key)}
              >
                <Icon size={14} strokeWidth={2.2} style={{ color: conf.color }} />
                {conf.label}
              </FilterMenuItem>
            );
          },
        )}
      </FilterMenu>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => {
            onClearAll();
            onSearchChange("");
          }}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--color-slate2)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            padding: "6px 4px",
            whiteSpace: "nowrap",
          }}
        >
          Limpiar filtros
        </button>
      ) : null}

      <div style={{ flex: 1, minWidth: 8 }} />

      <button
        type="button"
        onClick={onAddTask}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          height: 32,
          padding: "0 14px",
          border: "none",
          borderRadius: 6,
          background: "var(--color-brand)",
          color: "white",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          flexShrink: 0,
        }}
      >
        <Plus size={15} strokeWidth={2.5} />
        Crear
      </button>
    </div>
  );
}

// ─── KanbanBoard (root, owns DndContext) ──────────────────────────────────────

export default function KanbanBoard({
  initialTasks,
  profiles,
  units,
  searchTerm,
  onSearchChange,
}: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overColumnId, setOverColumnId] = useState<Task["status"] | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [unitFilter, setUnitFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<Task["type"][]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setCurrentUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function handleAddTask(
    taskData: Omit<Task, "id" | "position" | "created_by">,
  ): Promise<Task | undefined> {
    const colTasks = tasks
      .filter((t) => t.status === taskData.status)
      .sort((a, b) => a.position - b.position);
    const position = colTasks.length > 0 ? colTasks[colTasks.length - 1].position + 1000 : 0;

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        ...taskData,
        description: formatTaskDescription(taskData.description),
        position,
        created_by: currentUserId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding task:", error);
      throw error;
    }
    if (data) {
      setTasks((prev) => [...prev, data as Task]);
      return data as Task;
    }
  }

  async function handleSaveTask(updated: Task): Promise<string | null> {
    const normalized: Task = {
      ...updated,
      description: formatTaskDescription(updated.description),
      assignee: updated.assignee?.trim() ? updated.assignee : null,
      due_date: updated.due_date?.trim() ? updated.due_date : null,
    };
    const { error } = await supabase
      .from("tasks")
      .update({
        title: normalized.title,
        description: normalized.description,
        unit_code: normalized.unit_code,
        priority: normalized.priority,
        type: normalized.type,
        due_date: normalized.due_date,
        created_at: normalized.created_at,
        assignee: normalized.assignee,
      })
      .eq("id", normalized.id);

    if (error) {
      console.error("Error saving task:", error.message, error.code, error.details, error.hint);
      return error.message || "No se pudo guardar la tarea.";
    }
    setTasks((prev) => prev.map((t) => (t.id === normalized.id ? normalized : t)));
    setEditingTask(null);
    return null;
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

      {creatingTask && (
        <TaskCreateModal
          profiles={profiles}
          units={units}
          currentUserId={currentUserId}
          onCreate={handleAddTask}
          onClose={() => setCreatingTask(false)}
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
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        onToggleAssignee={toggleAssignee}
        onToggleUnit={toggleUnit}
        onToggleType={toggleType}
        onClearAll={clearAllFilters}
        onAddTask={() => setCreatingTask(true)}
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
