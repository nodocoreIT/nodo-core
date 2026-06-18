import type { SupabaseClient } from "@supabase/supabase-js";

/** Returns true when email already has a non-paused registration on this node. */
export async function isEmailRegisteredForNode(
  admin: SupabaseClient<any, "public", any>,
  email: string,
  unitCode: string,
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: access } = await admin
    .from("node_email_access")
    .select("status")
    .eq("email", normalizedEmail)
    .eq("unit_code", unitCode)
    .maybeSingle();

  if (access && access.status !== "pausado") return true;

  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (!client) return false;

  const { data: units } = await admin
    .from("client_units")
    .select("status")
    .eq("client_id", client.id)
    .eq("unit_code", unitCode);

  return (units ?? []).some((u) => u.status !== "pausado");
}

export function duplicateRegistrationMessage(nodeLabel: string): string {
  return `Ya existe un usuario registrado con este correo en ${nodeLabel}. Iniciá sesión o recuperá tu contraseña si olvidaste tus datos.`;
}
