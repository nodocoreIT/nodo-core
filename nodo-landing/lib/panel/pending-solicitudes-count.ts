import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Count of solicitudes that still need admin action on /panel/solicitudes:
 * - client_units in `pending_review`
 * - clinic pending registrations (RPC), when the caller can see them
 */
export async function fetchPendingSolicitudesCount(
  // Accepts a schema-scoped client (the panel client is scoped to "nodo_core",
  // not the default "public") — this function only does untyped .from/.rpc
  // calls, so the schema generic doesn't matter here.
  supabase: SupabaseClient<any, any, any, any, any>,
): Promise<number> {
  const { count, error } = await supabase
    .from("client_units")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_review");

  if (error) throw error;

  let clinicCount = 0;
  const { data: clinicRows, error: clinicError } = await supabase.rpc(
    "admin_get_clinic_registrations",
  );

  if (!clinicError && Array.isArray(clinicRows)) {
    const now = Date.now();
    clinicCount = clinicRows.filter((row: { expires_at?: string; verified_at?: string | null }) => {
      // Still actionable: email pending (not expired) or onboarding done / in progress
      if (row.verified_at) return true;
      if (!row.expires_at) return true;
      return new Date(row.expires_at).getTime() >= now;
    }).length;
  }

  return (count ?? 0) + clinicCount;
}
