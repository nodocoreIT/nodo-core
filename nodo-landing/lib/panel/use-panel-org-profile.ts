import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TenantProfileRow } from "@nodocore/nodo-modules/settings";

const ROW_ID = "default";

export function usePanelOrgProfile() {
  const [profile, setProfile] = useState<TenantProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("panel_org_profile")
      .select("*")
      .eq("id", ROW_ID)
      .maybeSingle();
    if (!error) setProfile((data as TenantProfileRow) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { profile, loading, refresh };
}

export async function upsertPanelOrgProfile(input: Record<string, unknown>) {
  const supabase = createClient();
  const { error } = await supabase
    .from("panel_org_profile")
    .upsert({ id: ROW_ID, ...input, updated_at: new Date().toISOString() });
  if (error) throw error;
}

const BUCKET = "panel-branding";

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
}

export async function uploadPanelLogo(file: File, variant: "logo" | "pdf-logo" = "logo") {
  const supabase = createClient();
  const key = `default/${variant}-${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
  const { data, error } = await supabase.storage.from(BUCKET).upload(key, file, { upsert: true });
  if (error) throw error;
  return data?.path ?? key;
}

export async function getPanelLogoSignedUrl(path: string | null | undefined) {
  if (!path) return null;
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
