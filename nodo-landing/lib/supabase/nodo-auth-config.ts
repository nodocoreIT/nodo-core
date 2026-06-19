import { getNodeBySlug, normalizeNodeSlug } from "@/lib/nodes";

const ENV_PREFIX: Record<string, string> = {
  inmo: "NODO_INMO",
  autos: "NODO_AUTOS",
  finanzas: "NODO_FINANZAS",
  salud: "NODO_CLINICA",
  clinica: "NODO_CLINICA",
  clínica: "NODO_CLINICA",
};

/** Auth project code for provisioned nodos (e.g. Finanzas, Inmo). */
export function getNodoAuthCode(nodeSlug: string): string | null {
  const slug = normalizeNodeSlug(nodeSlug);
  const node = getNodeBySlug(slug);
  return node?.code ?? null;
}

function envPrefixForCode(authCode: string): string | null {
  return ENV_PREFIX[authCode.toLowerCase()] ?? null;
}

/** Public Supabase URL + anon key for a nodo auth project (browser-safe env vars). */
export function getNodoPublicAuthConfig(authCode: string): {
  url: string;
  anonKey: string;
} | null {
  const prefix = envPrefixForCode(authCode);
  const landingUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const landingAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (prefix) {
    const url =
      process.env[`NEXT_PUBLIC_${prefix}_SUPABASE_URL`] ??
      process.env[`${prefix}_SUPABASE_URL`] ??
      landingUrl;
    const anonKey =
      process.env[`NEXT_PUBLIC_${prefix}_SUPABASE_ANON_KEY`] ?? landingAnon;
    if (url && anonKey) return { url, anonKey };
  }

  if (landingUrl && landingAnon) return { url: landingUrl, anonKey: landingAnon };
  return null;
}

export function nodoAuthProjectParam(authCode: string | null): string {
  if (!authCode) return "";
  return authCode.toLowerCase();
}
