import { createNodoAuthClient } from "@nodocore/shared-components";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local",
  );
}

/**
 * Root Supabase client — used for auth (signIn, signOut, onAuthStateChange).
 * Session is persisted in localStorage with a nodo-specific key (see createNodoAuthClient).
 */
export const supabase = createNodoAuthClient(supabaseUrl, supabaseAnonKey, "finanzas");

/**
 * Schema-scoped client — used for all data queries against nodo_finanzas_personales.
 */
export const db = supabase.schema("nodo_finanzas_personales") as ReturnType<
  typeof supabase.schema
>;
