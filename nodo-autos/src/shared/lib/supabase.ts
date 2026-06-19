import { createNodoAuthClient } from "@nodocore/shared-components";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local",
  );
}

/**
 * Supabase client singleton.
 *
 * Auth / storage:  supabase.auth, supabase.storage
 * nodo_autos:      autosDb().from("table_name")  — same pattern as nodo_inmo.schema("nodo_inmo")
 */
export const supabase = createNodoAuthClient(supabaseUrl, supabaseAnonKey, "autos");

/** App tables live in the nodo_autos schema (isolated like nodo_inmo on shared projects). */
export const AUTOS_SCHEMA = "nodo_autos";

export function autosDb() {
  return supabase.schema(AUTOS_SCHEMA);
}
