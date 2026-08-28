import { RecetaAccessLanding } from "@/components/patient/receta-access-landing";

interface PageProps {
  params: Promise<{ accessToken: string }>;
}

/**
 * Fase 3 de "Recetas" — public magic-link landing for a standalone receta.
 * Deliberately OUTSIDE the /paciente/(portal) route group (which requires an
 * authenticated session): this page must be reachable by a patient who has
 * no account yet. Mirrors the /paciente/sala/[token] split (thin server page
 * that unwraps params + a client component that does the data fetching).
 */
export default async function RecetaAccessPage({ params }: PageProps) {
  const { accessToken } = await params;
  return <RecetaAccessLanding accessToken={accessToken} />;
}
