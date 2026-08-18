import { Suspense } from "react";
import { LoginForm } from "@/app/[nodeSlug]/login/page";
import { ClinicaRedirectClient } from "./clinica-redirect-client";

/**
 * /nodo-clinica/login handler:
 * - mode=register → render the landing registration form (doctor subscription)
 * - all other modes → redirect to the clinica app (client-side — see
 *   ClinicaRedirectClient for why this can't be a plain server redirect())
 */
export default function NodoClinicaLoginPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const mode = searchParams.mode;
  const role = searchParams.role;

  if (mode === "register") {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-navy-900 text-white flex items-center justify-center font-semibold">
            Cargando...
          </div>
        }
      >
        <LoginForm forcedNodeSlug="nodo-clinica" />
      </Suspense>
    );
  }

  const CLINICA_APP_URL =
    process.env.NEXT_PUBLIC_CLINICA_APP_URL ?? "https://clinica.nodocore.com.ar";

  const dest = new URL(`${CLINICA_APP_URL}/login`);
  if (typeof role === "string") dest.searchParams.set("role", role);
  if (typeof mode === "string") dest.searchParams.set("mode", mode);

  return <ClinicaRedirectClient dest={dest.toString()} />;
}
