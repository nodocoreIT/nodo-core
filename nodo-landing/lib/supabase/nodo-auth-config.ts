import { getNodeBySlug, normalizeNodeSlug } from "@/lib/nodes";

const ENV_PREFIX: Record<string, string> = {
  inmo: "NODO_INMO",
  autos: "NODO_AUTOS",
  finanzas: "NODO_FINANZAS",
  salud: "NODO_CLINICA",
  clinica: "NODO_CLINICA",
  clínica: "NODO_CLINICA",
};

/** Nodos with a dedicated Supabase Auth project — must not fall back to landing auth. */
const DEDICATED_AUTH_CODES = new Set(Object.keys(ENV_PREFIX));

/**
 * Literal env refs — Next.js only inlines NEXT_PUBLIC_* into the client bundle
 * when accessed with a static property name (not process.env[dynamicKey]).
 */
const NODO_PUBLIC_AUTH: Record<
  string,
  { url: string | undefined; anonKey: string | undefined }
> = {
  NODO_INMO: {
    url: process.env.NEXT_PUBLIC_NODO_INMO_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_NODO_INMO_SUPABASE_ANON_KEY,
  },
  NODO_AUTOS: {
    url: process.env.NEXT_PUBLIC_NODO_AUTOS_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_NODO_AUTOS_SUPABASE_ANON_KEY,
  },
  NODO_FINANZAS: {
    url: process.env.NEXT_PUBLIC_NODO_FINANZAS_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_NODO_FINANZAS_SUPABASE_ANON_KEY,
  },
  NODO_CLINICA: {
    url: process.env.NEXT_PUBLIC_NODO_CLINICA_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_NODO_CLINICA_SUPABASE_ANON_KEY,
  },
};

function envPrefixForCode(authCode: string): string | null {
  return ENV_PREFIX[authCode.toLowerCase()] ?? null;
}

function isDedicatedAuthProject(authCode: string): boolean {
  return DEDICATED_AUTH_CODES.has(authCode.toLowerCase());
}

/** Public Supabase URL + anon key for a nodo auth project (browser-safe env vars). */
export function getNodoPublicAuthConfig(authCode: string): {
  url: string;
  anonKey: string;
} | null {
  const prefix = envPrefixForCode(authCode);
  const landingUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const landingAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isServer = typeof window === "undefined";

  if (prefix) {
    const publicCfg = NODO_PUBLIC_AUTH[prefix];
    const url =
      publicCfg?.url ??
      (isServer ? process.env[`${prefix}_SUPABASE_URL`] : undefined);
    const anonKey =
      publicCfg?.anonKey ??
      (isServer ? process.env[`${prefix}_SUPABASE_ANON_KEY`] : undefined);

    if (url && anonKey) return { url, anonKey };

    // Provisioned nodos must never authenticate against the landing project.
    if (isDedicatedAuthProject(authCode)) return null;

    if (landingUrl && landingAnon) return { url: landingUrl, anonKey: landingAnon };
    return null;
  }

  if (landingUrl && landingAnon) return { url: landingUrl, anonKey: landingAnon };
  return null;
}

export function getNodoPublicAuthConfigError(authCode: string): string | null {
  if (!isDedicatedAuthProject(authCode)) return null;
  const prefix = envPrefixForCode(authCode);
  if (!prefix) return null;
  const cfg = getNodoPublicAuthConfig(authCode);
  if (cfg) return null;
  return `Configurá NEXT_PUBLIC_${prefix}_SUPABASE_URL y NEXT_PUBLIC_${prefix}_SUPABASE_ANON_KEY para el login de ${authCode}.`;
}

export function nodoAuthProjectParam(authCode: string | null): string {
  if (!authCode) return "";
  return authCode.toLowerCase();
}

/** Auth project code for provisioned nodos (e.g. Finanzas, Inmo). */
export function getNodoAuthCode(nodeSlug: string): string | null {
  const slug = normalizeNodeSlug(nodeSlug);
  const node = getNodeBySlug(slug);
  return node?.code ?? null;
}
