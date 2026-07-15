import { redirect } from "next/navigation";

/**
 * Redirect /nodo-clinica/login[?role=paciente|?mode=register] to the
 * clinica app. The clinica app handles both login and registration.
 */
export default function NodoClinicaLoginRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const CLINICA_APP_URL =
    process.env.NEXT_PUBLIC_CLINICA_APP_URL ?? "https://clinica.nodocore.com.ar";

  const role = searchParams.role;
  const mode = searchParams.mode;

  // Build the destination URL preserving useful query params
  const dest = new URL(`${CLINICA_APP_URL}/login`);
  if (typeof role === "string") dest.searchParams.set("role", role);
  if (typeof mode === "string") dest.searchParams.set("mode", mode);

  redirect(dest.toString());
}
