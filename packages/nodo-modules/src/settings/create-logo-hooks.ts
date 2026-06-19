import { useMutation, useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

const TTL_SECONDS = 3_600;

export interface LogoHooksConfig {
  bucket: string;
  getFolderId: () => string | null | undefined;
  supabase: SupabaseClient;
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
}

export function createLogoHooks(config: LogoHooksConfig) {
  const { bucket, getFolderId, supabase } = config;

  async function createSignedUrl(path: string | null | undefined): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, TTL_SECONDS);
    if (error) throw error;
    return data?.signedUrl ?? null;
  }

  function useUploadLogo() {
    return useMutation({
      mutationFn: async ({
        file,
        variant = "logo",
      }: {
        file: File;
        variant?: "logo" | "pdf-logo";
      }) => {
        const folderId = getFolderId();
        if (!folderId) throw new Error("Tenant no identificado");
        const key = `${folderId}/${variant}-${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
        const { data, error } = await supabase.storage.from(bucket).upload(key, file, { upsert: true });
        if (error) throw error;
        return data?.path ?? key;
      },
    });
  }

  function useLogoSignedUrl(path: string | null | undefined) {
    return useQuery<string | null>({
      queryKey: ["storage", "logo-url", bucket, path],
      queryFn: () => createSignedUrl(path),
      enabled: Boolean(path),
      staleTime: 55 * 60 * 1000,
    });
  }

  return { useUploadLogo, useLogoSignedUrl, createSignedUrl };
}

export type LogoHooks = ReturnType<typeof createLogoHooks>;
