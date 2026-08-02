import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResolvedClientUnit {
  id: string;
  clientId: string;
  unitCode: string;
  plan: string | null;
  enabledAt: string | null;
  accessUser: string | null;
}

/**
 * Resolves the client_unit row for an authenticated end user on a given nodo.
 * Mirrors nodo_core.get_my_client_unit_subscription lookup chain.
 */
export async function resolveClientUnitForAuthUser(
  db: SupabaseClient<any, "public", string, any, any>,
  params: { email: string; unitCode: string },
): Promise<ResolvedClientUnit | null> {
  const email = params.email.trim().toLowerCase();
  const unitCode = params.unitCode.trim();
  if (!email || !unitCode) return null;

  const { data: byNodeEmail } = await db
    .from("node_email_access")
    .select("client_unit_id")
    .ilike("email", email)
    .ilike("unit_code", unitCode)
    .maybeSingle();

  let clientUnitId = (byNodeEmail as { client_unit_id?: string } | null)?.client_unit_id;

  if (!clientUnitId) {
    const { data: clientRow } = await db
      .from("clients")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (clientRow?.id) {
      const { data: unitRow } = await db
        .from("client_units")
        .select("id")
        .eq("client_id", clientRow.id as string)
        .ilike("unit_code", unitCode)
        .maybeSingle();
      clientUnitId = (unitRow as { id?: string } | null)?.id;
    }
  }

  if (!clientUnitId) {
    const { data: byAccessUser } = await db
      .from("client_units")
      .select("id")
      .ilike("access_user", email)
      .ilike("unit_code", unitCode)
      .maybeSingle();

    clientUnitId = (byAccessUser as { id?: string } | null)?.id;
  }

  if (!clientUnitId) return null;

  const { data: unitRow } = await db
    .from("client_units")
    .select("id, client_id, unit_code, plan, enabled_at, access_user")
    .eq("id", clientUnitId)
    .maybeSingle();

  if (!unitRow) return null;

  const row = unitRow as {
    id: string;
    client_id: string;
    unit_code: string;
    plan: string | null;
    enabled_at: string | null;
    access_user: string | null;
  };

  return {
    id: row.id,
    clientId: row.client_id,
    unitCode: row.unit_code,
    plan: row.plan,
    enabledAt: row.enabled_at,
    accessUser: row.access_user,
  };
}
