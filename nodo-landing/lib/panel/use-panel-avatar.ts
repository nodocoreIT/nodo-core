import { createClient } from "@/lib/supabase/client";

const BUCKET = "panel-branding";
const AVATAR_MAX_DIMENSION = 256;
const AVATAR_JPEG_QUALITY = 0.85;
// Below this, re-encoding isn't worth the quality loss — most icon-sized
// exports/screenshots are already under this.
const AVATAR_SKIP_RESIZE_BYTES = 150 * 1024;

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Downscales + re-encodes the avatar to a small JPEG before upload.
 * Avatars only ever render at 18–32px (AssigneeAvatar), but nothing here
 * capped the source file — a phone photo straight off the camera roll
 * (several MB, thousands of px) was getting stored and re-downloaded in
 * full every time a task card or the toolbar showed that person's avatar,
 * which is what was blowing up LCP on /panel/tareas.
 */
async function resizeAvatarFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= AVATAR_SKIP_RESIZE_BYTES) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, AVATAR_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", AVATAR_JPEG_QUALITY),
  );
  if (!blob || blob.size >= file.size) return file;

  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

/**
 * Uploads the logged-in user's own avatar under avatars/{user_id}/... —
 * storage RLS (panel_branding_own_avatar_insert/update) only lets each
 * user write inside their own folder, unlike the shared "default/" logo
 * path. Returns the storage path (not a usable URL — the bucket is
 * private, resolve it via getPanelAvatarSignedUrl or server-side).
 */
export async function uploadPanelAvatar(file: File): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");

  const resized = await resizeAvatarFile(file);
  const key = `avatars/${user.id}/${crypto.randomUUID()}-${sanitizeFilename(resized.name)}`;
  const { data, error } = await supabase.storage.from(BUCKET).upload(key, resized, { upsert: true });
  if (error) throw error;
  return data?.path ?? key;
}

export async function getPanelAvatarSignedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
