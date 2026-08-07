"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Topbar from "@/components/panel/Topbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  FormSelect,
} from "@nodocore/shared-components";
import {
  Loader2,
  Mail,
  MailOpen,
  MessageSquareText,
  Reply,
  Trash2,
  X,
} from "lucide-react";
import type {
  FeedbackInboxRow,
  FeedbackReplyStatus,
} from "@/lib/panel/feedback-inbox";
import { useUnreadFeedbackCount } from "@/hooks/use-unread-feedback-count";

type ReadFilter = "all" | "unread" | "read";

const TICKET_STATUS_STYLES: Record<
  FeedbackReplyStatus,
  { bg: string; color: string; label: string }
> = {
  pendiente: { bg: "#E8EEF8", color: "#2A6FDB", label: "Pendiente" },
  en_proceso: { bg: "#FCE9D8", color: "#B5630C", label: "En proceso" },
  respondido: { bg: "#E6F4EC", color: "#1F8A5B", label: "Respondido" },
  resuelto: { bg: "var(--color-mist)", color: "var(--color-slate2)", label: "Resuelto" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const actionBtnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid var(--color-mist)",
  background: "white",
  cursor: "pointer",
  marginRight: 6,
};

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackInboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterReadStatus, setFilterReadStatus] = useState<ReadFilter>("all");
  const [filterNode, setFilterNode] = useState("all");
  const [pendingDelete, setPendingDelete] = useState<FeedbackInboxRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<FeedbackInboxRow | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyStatus, setReplyStatus] = useState<FeedbackReplyStatus>("respondido");
  const [replySaving, setReplySaving] = useState(false);
  const { refresh: refreshUnreadBadge } = useUnreadFeedbackCount();

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/panel/feedback");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo cargar el feedback.");
        setItems([]);
        return;
      }
      setItems(data.feedback ?? []);
    } catch {
      setError("Error de red al cargar el feedback.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) seen.set(item.category, item.categoryLabel);
    return [
      { value: "all", label: "Todas las categorías" },
      ...[...seen.entries()].map(([value, label]) => ({ value, label })),
    ];
  }, [items]);

  const nodeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) seen.set(item.sourceNode, item.sourceNodeLabel);
    return [
      { value: "all", label: "Todos los nodos" },
      ...[...seen.entries()].map(([value, label]) => ({ value, label })),
    ];
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filterCategory !== "all" && item.category !== filterCategory) return false;
      if (filterNode !== "all" && item.sourceNode !== filterNode) return false;
      if (filterReadStatus === "unread" && item.read) return false;
      if (filterReadStatus === "read" && !item.read) return false;
      return true;
    });
  }, [items, filterCategory, filterNode, filterReadStatus]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  async function toggleRead(item: FeedbackInboxRow) {
    if (processingIds.has(item.id)) return;

    setProcessingIds((prev) => new Set(prev).add(item.id));
    setError(null);
    const nextRead = !item.read;

    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? { ...row, read: nextRead, readAt: nextRead ? new Date().toISOString() : null }
          : row,
      ),
    );

    try {
      const res = await fetch("/api/panel/feedback/read", {
        method: nextRead ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback_id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setItems((prev) => prev.map((row) => (row.id === item.id ? item : row)));
        setError(data.error ?? "No se pudo actualizar el estado de lectura.");
      } else {
        void refreshUnreadBadge();
      }
    } catch {
      setItems((prev) => prev.map((row) => (row.id === item.id ? item : row)));
      setError("Error de red al actualizar el estado de lectura.");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  function openReply(item: FeedbackInboxRow) {
    setReplyTarget(item);
    setReplyBody("");
    setReplyStatus(item.status === "pendiente" ? "respondido" : item.status);
    setError(null);
    if (!item.read) void toggleRead(item);
  }

  async function submitReply() {
    if (!replyTarget || !replyBody.trim() || replySaving) return;
    setReplySaving(true);
    setError(null);
    try {
      const res = await fetch("/api/panel/feedback/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_id: replyTarget.id,
          body: replyBody.trim(),
          status: replyStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar la respuesta.");
        return;
      }
      await loadFeedback();
      void refreshUnreadBadge();
      setReplyTarget(null);
      setReplyBody("");
    } catch {
      setError("Error de red al guardar la respuesta.");
    } finally {
      setReplySaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const item = pendingDelete;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/panel/feedback", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo borrar el feedback.");
        return;
      }
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      if (!item.read) void refreshUnreadBadge();
    } catch {
      setError("Error de red al borrar el feedback.");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "white",
    border: "1px solid var(--color-mist)",
    borderRadius: 12,
    overflow: "hidden",
  };

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 14px",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--color-slate2)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid var(--color-mist)",
    background: "var(--color-paper)",
  };

  const tdStyle: React.CSSProperties = {
    padding: "12px 14px",
    fontSize: 13.5,
    color: "var(--color-ink)",
    borderBottom: "1px solid var(--color-mist)",
    verticalAlign: "middle",
  };

  return (
    <>
      <Topbar breadcrumb="Nodo Core · Panel" title="Feedback" />

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--color-slate2)", maxWidth: 720 }}>
          Historial completo de feedback enviado desde el nodito flotante de cada nodo: errores, ideas y cosas
          que sobran. {unreadCount > 0 ? `${unreadCount} sin leer.` : "Todo leído."}
        </p>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: 8,
              fontSize: 14,
              color: "#991B1B",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ minWidth: 200 }}>
            <FormSelect
              value={filterCategory}
              onChange={setFilterCategory}
              options={categoryOptions}
              aria-label="Filtrar por categoría"
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <FormSelect
              value={filterNode}
              onChange={setFilterNode}
              options={nodeOptions}
              aria-label="Filtrar por nodo"
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <FormSelect
              value={filterReadStatus}
              onChange={(v) => setFilterReadStatus(v as ReadFilter)}
              options={[
                { value: "all", label: "Todos los estados" },
                { value: "unread", label: "Sin leer" },
                { value: "read", label: "Leídos" },
              ]}
              aria-label="Filtrar por estado de lectura"
            />
          </div>
          <p style={{ margin: 0, alignSelf: "center", fontSize: 13, color: "var(--color-slate2)" }}>
            {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
          </p>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--color-slate2)" }}>
            <Loader2 className="inline h-5 w-5 animate-spin mr-2" />
            Cargando feedback...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ ...cardStyle, padding: 48, textAlign: "center", color: "var(--color-slate2)" }}>
            <MessageSquareText size={40} strokeWidth={1.5} style={{ opacity: 0.4, margin: "0 auto 12px" }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
              {items.length === 0 ? "Todavía no hay feedback" : "No hay feedback para estos filtros"}
            </p>
          </div>
        ) : (
          <div style={cardStyle}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Organización</th>
                    <th style={thStyle}>Nodo</th>
                    <th style={thStyle}>Categoría</th>
                    <th style={thStyle}>Contenido</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const st = TICKET_STATUS_STYLES[item.status] ?? TICKET_STATUS_STYLES.pendiente;
                    const busy = processingIds.has(item.id);
                    const unread = !item.read;

                    return (
                      <tr
                        key={item.id}
                        style={{
                          background: unread ? "#F3F7FC" : "white",
                        }}
                      >
                        <td
                          style={{
                            ...tdStyle,
                            color: "var(--color-slate2)",
                            fontWeight: unread ? 700 : 400,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatDate(item.createdAt)}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: unread ? 700 : 400 }}>{item.orgName}</td>
                        <td style={{ ...tdStyle, fontWeight: unread ? 700 : 400 }}>{item.sourceNodeLabel}</td>
                        <td style={{ ...tdStyle, fontWeight: unread ? 700 : 400 }}>{item.categoryLabel}</td>
                        <td
                          style={{
                            ...tdStyle,
                            maxWidth: 360,
                            wordBreak: "break-word",
                            fontWeight: unread ? 700 : 400,
                            color: unread ? "var(--color-navy)" : "var(--color-ink)",
                          }}
                        >
                          {item.content ?? "—"}
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 10px",
                              borderRadius: 999,
                              fontSize: 11.5,
                              fontWeight: 600,
                              background: st.bg,
                              color: st.color,
                            }}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            title={item.read ? "Marcar como no leído" : "Marcar como leído"}
                            disabled={busy}
                            onClick={() => void toggleRead(item)}
                            style={{
                              ...actionBtnBase,
                              color: unread ? "#2A6FDB" : "var(--color-slate2)",
                              cursor: busy ? "not-allowed" : "pointer",
                              opacity: busy ? 0.5 : 1,
                            }}
                          >
                            {item.read ? (
                              <MailOpen className="h-3.5 w-3.5" />
                            ) : (
                              <Mail className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Responder"
                            disabled={busy}
                            onClick={() => openReply(item)}
                            style={{
                              ...actionBtnBase,
                              color: "var(--color-brand)",
                              cursor: busy ? "not-allowed" : "pointer",
                              opacity: busy ? 0.5 : 1,
                            }}
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Borrar feedback"
                            disabled={busy}
                            onClick={() => setPendingDelete(item)}
                            style={{
                              ...actionBtnBase,
                              marginRight: 0,
                              color: "var(--color-destructive)",
                              cursor: busy ? "not-allowed" : "pointer",
                              opacity: busy ? 0.5 : 1,
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {replyTarget && (
        <div
          onClick={() => !replySaving && setReplyTarget(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(18,30,47,.52)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 12,
              width: "100%",
              maxWidth: 520,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 8px 32px rgba(18,30,47,.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--color-mist)",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 16, color: "var(--color-navy)" }}>
                Responder feedback
              </span>
              <button
                type="button"
                onClick={() => !replySaving && setReplyTarget(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-slate2)",
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "var(--color-paper)",
                  border: "1px solid var(--color-mist)",
                }}
              >
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "var(--color-slate2)", textTransform: "uppercase" }}>
                  Pregunta del cliente
                </p>
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-ink)", whiteSpace: "pre-wrap" }}>
                  {replyTarget.content ?? "—"}
                </p>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--color-slate2)" }}>
                  {replyTarget.orgName} · {replyTarget.sourceNodeLabel} · {formatDate(replyTarget.createdAt)}
                </p>
              </div>

              {replyTarget.replies.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--color-slate2)", textTransform: "uppercase" }}>
                    Historial
                  </p>
                  {replyTarget.replies.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        border: "1px solid var(--color-mist)",
                        background: "#F8FBFF",
                      }}
                    >
                      <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600, color: "var(--color-navy)" }}>
                        {r.authorLabel} · {formatDate(r.createdAt)}
                      </p>
                      <p style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap" }}>{r.body}</p>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--color-slate2)",
                    textTransform: "uppercase",
                  }}
                >
                  Estado
                </label>
                <FormSelect
                  value={replyStatus}
                  onChange={(v) => setReplyStatus(v as FeedbackReplyStatus)}
                  options={[
                    { value: "en_proceso", label: "En proceso" },
                    { value: "respondido", label: "Respondido" },
                    { value: "resuelto", label: "Resuelto" },
                  ]}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--color-slate2)",
                    textTransform: "uppercase",
                  }}
                >
                  Respuesta
                </label>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={4}
                  placeholder="Escribí la respuesta que verá el cliente en el nodito…"
                  autoFocus
                  style={{
                    width: "100%",
                    border: "1px solid var(--color-mist)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 13.5,
                    fontFamily: "var(--font-sans)",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => void submitReply()}
                  disabled={replySaving || !replyBody.trim()}
                  style={{
                    flex: 1,
                    background: "var(--color-brand)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: replySaving || !replyBody.trim() ? "not-allowed" : "pointer",
                    opacity: replySaving || !replyBody.trim() ? 0.6 : 1,
                  }}
                >
                  {replySaving ? "Enviando…" : "Enviar respuesta"}
                </button>
                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  disabled={replySaving}
                  style={{
                    border: "1px solid var(--color-mist)",
                    borderRadius: 8,
                    padding: "10px 16px",
                    background: "white",
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "var(--color-slate2)",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este feedback?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El feedback se va a borrar permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? "Borrando..." : "Borrar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
