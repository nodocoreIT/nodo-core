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
import { CheckCircle2, Loader2, MessageSquareText, RotateCcw, Trash2 } from "lucide-react";
import type { FeedbackInboxRow } from "@/lib/panel/feedback-inbox";

type ReadFilter = "all" | "unread" | "read";

const READ_STATUS_STYLES: Record<"read" | "unread", { bg: string; color: string; label: string }> = {
  unread: { bg: "#E8EEF8", color: "#2A6FDB", label: "Sin leer" },
  read: { bg: "var(--color-mist)", color: "var(--color-slate2)", label: "Leído" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

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
    // Guard: ignore a second click on the same item while its request is still in flight.
    if (processingIds.has(item.id)) return;

    setProcessingIds((prev) => new Set(prev).add(item.id));
    setError(null);
    const nextRead = !item.read;

    // Optimistic update — flip locally before the request resolves.
    setItems((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, read: nextRead, readAt: nextRead ? new Date().toISOString() : null } : row)),
    );

    try {
      const res = await fetch("/api/panel/feedback/read", {
        method: nextRead ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback_id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Roll back on failure.
        setItems((prev) => prev.map((row) => (row.id === item.id ? item : row)));
        setError(data.error ?? "No se pudo actualizar el estado de lectura.");
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
      // Recién sacamos el item de la lista después de que el borrado en
      // el server confirmó — a diferencia de toggleRead, acá no hay
      // rollback posible que tenga sentido mostrar (es irreversible).
      setItems((prev) => prev.filter((row) => row.id !== item.id));
    } catch {
      setError("Error de red al borrar el feedback.");
    } finally {
      // Siempre cerramos el diálogo al terminar (éxito o error) — el
      // mensaje de error queda visible en el banner de arriba, que el
      // modal tapa mientras está abierto.
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
                    <th style={thStyle}>Categoría</th>
                    <th style={thStyle}>Contenido</th>
                    <th style={thStyle}>Nodo</th>
                    <th style={thStyle}>Organización</th>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const st = READ_STATUS_STYLES[item.read ? "read" : "unread"];
                    const busy = processingIds.has(item.id);

                    return (
                      <tr key={item.id}>
                        <td style={tdStyle}>{item.categoryLabel}</td>
                        <td style={{ ...tdStyle, maxWidth: 360, wordBreak: "break-word" }}>{item.content ?? "—"}</td>
                        <td style={tdStyle}>{item.sourceNodeLabel}</td>
                        <td style={tdStyle}>{item.orgName}</td>
                        <td style={{ ...tdStyle, color: "var(--color-slate2)" }}>{formatDate(item.createdAt)}</td>
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
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              border: "1px solid var(--color-mist)",
                              background: "white",
                              color: "var(--color-slate2)",
                              cursor: busy ? "not-allowed" : "pointer",
                              opacity: busy ? 0.5 : 1,
                              marginRight: 6,
                            }}
                          >
                            {item.read ? (
                              <RotateCcw className="h-3.5 w-3.5" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Borrar feedback"
                            disabled={busy}
                            onClick={() => setPendingDelete(item)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              border: "1px solid var(--color-mist)",
                              background: "white",
                              color: "#B91C1C",
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
