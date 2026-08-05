import { createClient } from "@/lib/supabase/client";

const BUCKET = "panel-branding";

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
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

  const key = `avatars/${user.id}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
  const { data, error } = await supabase.storage.from(BUCKET).upload(key, file, { upsert: true });
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
