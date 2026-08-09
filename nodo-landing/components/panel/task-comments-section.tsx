"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, MessageSquareText, Play, Trash2, X } from "lucide-react";
import {
  ALLOWED_EVIDENCE_MIME,
  createTaskComment,
  deleteTaskComment,
  fetchTaskComments,
  type TaskComment,
} from "@/lib/panel/task-comments";

function isVideoMime(mime: string): boolean {
  return mime.startsWith("video/");
}

type ProfileLite = {
  id: string;
  full_name: string;
  initials: string;
  color: string;
  avatar_url?: string | null;
};

function formatCommentDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AuthorChip({
  author,
  profiles,
}: {
  author: TaskComment["author"];
  profiles: ProfileLite[];
}) {
  const profile =
    author && profiles.find((p) => p.id === author.id)
      ? profiles.find((p) => p.id === author.id)!
      : null;
  const name = profile?.full_name ?? author?.fullName ?? "Equipo";
  const initials = profile?.initials ?? author?.initials ?? "?";
  const color = profile?.color ?? author?.color ?? "#9DACBE";
  const avatar = profile?.avatar_url ?? null;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt={name}
          style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }}
        />
      ) : (
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: color,
            color: "white",
            fontSize: 10,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {initials}
        </span>
      )}
      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-navy)" }}>{name}</span>
    </span>
  );
}

type PendingFile = { id: string; file: File; previewUrl: string };

export function TaskCommentsSection({
  taskId,
  profiles,
}: {
  taskId: string;
  profiles: ProfileLite[];
}) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setComments(await fetchTaskComments(taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el historial.");
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      for (const f of pendingFiles) URL.revokeObjectURL(f.previewUrl);
    };
    // Only revoke on unmount of current pending set via replace below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(files: File[]) {
    if (files.length === 0) return;
    const next: PendingFile[] = [];
    for (const file of files) {
      if (!ALLOWED_EVIDENCE_MIME.has(file.type)) continue;
      next.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    setPendingFiles((prev) => [...prev, ...next].slice(0, 8));
  }

  function handleFileInputChange(list: FileList | null) {
    addFiles(list ? Array.from(list) : []);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /** Ctrl+V a screenshot or short screen recording straight into the comment box. */
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
      ALLOWED_EVIDENCE_MIME.has(f.type),
    );
    if (files.length === 0) return;
    e.preventDefault();
    addFiles(files);
  }

  function removePending(id: string) {
    setPendingFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  }

  async function handlePost() {
    if (posting) return;
    if (!body.trim() && pendingFiles.length === 0) return;
    setPosting(true);
    setError(null);
    try {
      const created = await createTaskComment({
        taskId,
        body,
        files: pendingFiles.map((p) => p.file),
      });
      setComments((prev) => [...prev, created]);
      setBody("");
      for (const f of pendingFiles) URL.revokeObjectURL(f.previewUrl);
      setPendingFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo publicar el comentario.");
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(comment: TaskComment) {
    if (deletingId) return;
    setDeletingId(comment.id);
    setError(null);
    try {
      await deleteTaskComment(comment);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar el comentario.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      style={{
        marginTop: 4,
        borderTop: "1px solid var(--color-mist)",
        paddingTop: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <MessageSquareText size={15} color="var(--color-slate2)" />
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--color-slate2)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            fontFamily: "var(--font-sans)",
          }}
        >
          Comentarios e historial
        </span>
        <span style={{ fontSize: 12, color: "var(--color-slate2)" }}>
          ({comments.length})
        </span>
      </div>

      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--color-slate2)",
            fontSize: 13,
            padding: "8px 0",
          }}
        >
          <Loader2 size={14} className="animate-spin" />
          Cargando comentarios…
        </div>
      ) : comments.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-slate2)" }}>
          Todavía no hay comentarios. Dejá notas o subí capturas como evidencia.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            maxHeight: 280,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {comments.map((comment) => (
            <div
              key={comment.id}
              style={{
                border: "1px solid var(--color-mist)",
                borderRadius: 8,
                padding: "10px 12px",
                background: "var(--color-paper)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <AuthorChip author={comment.author} profiles={profiles} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11.5, color: "var(--color-slate2)" }}>
                    {formatCommentDate(comment.createdAt)}
                  </span>
                  <button
                    type="button"
                    title="Borrar comentario"
                    disabled={deletingId === comment.id}
                    onClick={() => void handleDelete(comment)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#C0392B",
                      cursor: "pointer",
                      padding: 2,
                      opacity: deletingId === comment.id ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {comment.body ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    color: "var(--color-ink)",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.45,
                  }}
                >
                  {comment.body}
                </p>
              ) : null}
              {comment.attachments.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: comment.body ? 8 : 0,
                  }}
                >
                  {comment.attachments.map((att) =>
                    att.signedUrl ? (
                      <button
                        key={att.id}
                        type="button"
                        onClick={() => setLightbox({ url: att.signedUrl!, mimeType: att.mimeType })}
                        title={att.fileName}
                        style={{
                          position: "relative",
                          padding: 0,
                          border: "1px solid var(--color-mist)",
                          borderRadius: 6,
                          overflow: "hidden",
                          cursor: "pointer",
                          background: "white",
                        }}
                      >
                        {isVideoMime(att.mimeType) ? (
                          <>
                            <video
                              src={att.signedUrl}
                              muted
                              style={{ width: 72, height: 72, objectFit: "cover", display: "block" }}
                            />
                            <span
                              style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "rgba(18,30,47,.35)",
                              }}
                            >
                              <Play size={20} color="white" fill="white" />
                            </span>
                          </>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={att.signedUrl}
                            alt={att.fileName}
                            style={{
                              width: 72,
                              height: 72,
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                        )}
                      </button>
                    ) : (
                      <span
                        key={att.id}
                        style={{ fontSize: 12, color: "var(--color-slate2)" }}
                      >
                        {att.fileName}
                      </span>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          border: "1px solid var(--color-mist)",
          borderRadius: 8,
          padding: 10,
          background: "white",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={handlePaste}
          rows={3}
          placeholder="Escribí un comentario… (qué pasó, avances, blockers — pegá una captura o video con Ctrl+V)"
          style={{
            width: "100%",
            border: "1px solid var(--color-mist)",
            borderRadius: 6,
            padding: "8px 10px",
            fontSize: 13.5,
            fontFamily: "var(--font-sans)",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {pendingFiles.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {pendingFiles.map((f) => (
              <div
                key={f.id}
                style={{
                  position: "relative",
                  width: 64,
                  height: 64,
                  borderRadius: 6,
                  overflow: "hidden",
                  border: "1px solid var(--color-mist)",
                }}
              >
                {isVideoMime(f.file.type) ? (
                  <video
                    src={f.previewUrl}
                    muted
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.previewUrl}
                    alt={f.file.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => removePending(f.id)}
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 18,
                    height: 18,
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
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            multiple
            hidden
            onChange={(e) => handleFileInputChange(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid var(--color-mist)",
              borderRadius: 6,
              background: "white",
              padding: "7px 10px",
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--color-slate2)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            <ImagePlus size={14} />
            Evidencia
          </button>
          <button
            type="button"
            onClick={() => void handlePost()}
            disabled={posting || (!body.trim() && pendingFiles.length === 0)}
            style={{
              marginLeft: "auto",
              background: "var(--color-brand)",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "7px 14px",
              fontSize: 12.5,
              fontWeight: 700,
              cursor:
                posting || (!body.trim() && pendingFiles.length === 0)
                  ? "not-allowed"
                  : "pointer",
              opacity: posting || (!body.trim() && pendingFiles.length === 0) ? 0.65 : 1,
              fontFamily: "var(--font-sans)",
            }}
          >
            {posting ? "Publicando…" : "Comentar"}
          </button>
        </div>
      </div>

      {error ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "#b91c1c" }}>{error}</p>
      ) : null}

      {lightbox ? (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            background: "rgba(18,30,47,.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          {isVideoMime(lightbox.mimeType) ? (
            <video
              src={lightbox.url}
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "min(960px, 100%)",
                maxHeight: "90vh",
                borderRadius: 8,
                boxShadow: "0 12px 40px rgba(0,0,0,.35)",
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox.url}
              alt="Evidencia"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "min(960px, 100%)",
                maxHeight: "90vh",
                borderRadius: 8,
                boxShadow: "0 12px 40px rgba(0,0,0,.35)",
              }}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
