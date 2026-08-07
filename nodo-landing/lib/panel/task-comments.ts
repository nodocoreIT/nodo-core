import { createClient } from "@/lib/supabase/client";

export const TASK_EVIDENCE_BUCKET = "panel-task-evidence";
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type TaskCommentAttachment = {
  id: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  signedUrl: string | null;
};

export type TaskComment = {
  id: string;
  taskId: string;
  authorId: string | null;
  body: string;
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    initials: string;
    color: string;
    avatarUrl: string | null;
  } | null;
  attachments: TaskCommentAttachment[];
};

type RawAttachment = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number | null;
};

type RawComment = {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  author:
    | {
        id: string;
        full_name: string;
        initials: string;
        color: string;
        avatar_url: string | null;
      }
    | Array<{
        id: string;
        full_name: string;
        initials: string;
        color: string;
        avatar_url: string | null;
      }>
    | null;
  attachments: RawAttachment[] | null;
};

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function assertImageFile(file: File) {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Solo se permiten imágenes JPG, PNG, WEBP o GIF.");
  }
  if (file.size > MAX_EVIDENCE_BYTES) {
    throw new Error("Cada imagen puede pesar hasta 5 MB.");
  }
}

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const supabase = createClient();
  const { data } = await supabase.storage
    .from(TASK_EVIDENCE_BUCKET)
    .createSignedUrls(paths, 3600);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) {
      map.set(item.path, item.signedUrl);
    }
  }
  return map;
}

function mapComment(row: RawComment, signed: Map<string, string>): TaskComment {
  const authorRaw = Array.isArray(row.author) ? row.author[0] ?? null : row.author;
  return {
    id: row.id,
    taskId: row.task_id,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    author: authorRaw
      ? {
          id: authorRaw.id,
          fullName: authorRaw.full_name,
          initials: authorRaw.initials,
          color: authorRaw.color,
          avatarUrl: authorRaw.avatar_url,
        }
      : null,
    attachments: (row.attachments ?? []).map((a) => ({
      id: a.id,
      storagePath: a.storage_path,
      fileName: a.file_name,
      mimeType: a.mime_type,
      sizeBytes: a.size_bytes,
      signedUrl: signed.get(a.storage_path) ?? null,
    })),
  };
}

export async function fetchTaskComments(taskId: string): Promise<TaskComment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .select(
      `
      id,
      task_id,
      author_id,
      body,
      created_at,
      author:profiles!author_id (
        id,
        full_name,
        initials,
        color,
        avatar_url
      ),
      attachments:task_comment_attachments (
        id,
        storage_path,
        file_name,
        mime_type,
        size_bytes
      )
    `,
    )
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as RawComment[];
  const paths = rows.flatMap((r) => (r.attachments ?? []).map((a) => a.storage_path));
  const signed = await signPaths(paths);
  return rows.map((row) => mapComment(row, signed));
}

export async function createTaskComment(options: {
  taskId: string;
  body: string;
  files?: File[];
}): Promise<TaskComment> {
  const body = options.body.trim();
  const files = options.files ?? [];
  if (!body && files.length === 0) {
    throw new Error("Escribí un comentario o adjuntá una imagen.");
  }
  for (const file of files) assertImageFile(file);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");

  const { data: inserted, error: insertError } = await supabase
    .from("task_comments")
    .insert({
      task_id: options.taskId,
      author_id: user.id,
      body,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;
  const commentId = inserted.id as string;

  const attachmentRows: Array<{
    comment_id: string;
    storage_path: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
  }> = [];

  for (const file of files) {
    const path = `${options.taskId}/${commentId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(TASK_EVIDENCE_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) throw uploadError;
    attachmentRows.push({
      comment_id: commentId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    });
  }

  if (attachmentRows.length > 0) {
    const { error: attError } = await supabase
      .from("task_comment_attachments")
      .insert(attachmentRows);
    if (attError) throw attError;
  }

  const comments = await fetchTaskComments(options.taskId);
  const created = comments.find((c) => c.id === commentId);
  if (!created) throw new Error("El comentario se creó pero no se pudo recargar.");
  return created;
}

export async function deleteTaskComment(comment: TaskComment): Promise<void> {
  const supabase = createClient();
  const paths = comment.attachments.map((a) => a.storagePath);

  const { error } = await supabase.from("task_comments").delete().eq("id", comment.id);
  if (error) throw error;

  if (paths.length > 0) {
    await supabase.storage.from(TASK_EVIDENCE_BUCKET).remove(paths);
  }
}
