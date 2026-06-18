import { useOrgProfile } from "./use-org-profile";
import { useLogoUrl } from "./use-logo-url";

/**
 * Signed URL for the PDF-specific logo (pdf_logo_path).
 * Separate from the app sidebar logo — PDFs need a non-transparent version.
 */
export function usePdfLogoUrl() {
  const { data: profile, isLoading: profileLoading } = useOrgProfile();
  const { data: logoUrl, isLoading: urlLoading } = useLogoUrl(profile?.pdf_logo_path);

  return {
    data: logoUrl ?? null,
    isLoading: profileLoading || urlLoading,
  };
}
