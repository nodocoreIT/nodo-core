import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";

const BUCKET = "org-branding";
/** Signed URL TTL in seconds (1 h — refreshed by React Query before expiry). */
const TTL_SECONDS = 3_600;

/**
 * Generate a signed URL for a logo stored in the private org-branding bucket.
 *
 * NEVER uses getPublicUrl — the bucket is private and public URLs are blocked.
 * Signed URLs are scoped by the storage RLS policy (admin + org path check).
 * Mirrors use-receipt-url.ts from property-expenses.
 */
export function useLogoUrl(logoPath: string | null | undefined) {
  return useQuery<string | null>({
    queryKey: ["storage", "logo-url", logoPath],
    queryFn: async () => {
      if (!logoPath) return null;

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(logoPath, TTL_SECONDS);

      if (error) throw error;
      return data?.signedUrl ?? null;
    },
    enabled: !!logoPath,
    // Refresh 5 minutes before the signed URL expires (TTL 3600 s).
    staleTime: 55 * 60 * 1000,
  });
}
