import type { SupabaseClient } from "@supabase/supabase-js";

export type PurgeResult = {
  ok: true;
  org_id?: string;
  user_id: string;
  counts: Record<string, number>;
  storage_files_removed?: number;
};

async function resolveAdminOrgId(
  admin: SupabaseClient,
  userId: string,
  product: string,
): Promise<string | null> {
  const { data: memberships, error: memberErr } = await admin
    .schema("shared")
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("role", "admin");

  if (!memberErr && memberships?.length) {
    const orgIds = memberships.map((row) => row.org_id as string);
    const { data: org, error: orgErr } = await admin
      .schema("shared")
      .from("organizations")
      .select("id")
      .in("id", orgIds)
      .eq("product", product)
      .maybeSingle();

    if (!orgErr && org?.id) return org.id as string;
  }

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const orgIdFromClaims = authUser.user?.app_metadata?.org_id;
  if (typeof orgIdFromClaims === "string" && orgIdFromClaims) {
    const { data: org, error: orgErr } = await admin
      .schema("shared")
      .from("organizations")
      .select("id")
      .eq("id", orgIdFromClaims)
      .eq("product", product)
      .maybeSingle();

    if (!orgErr && org?.id) return org.id as string;
  }

  return null;
}

async function purgeInmoStorage(admin: SupabaseClient, orgId: string): Promise<number> {
  const bucket = admin.storage.from("org-documents");
  let removed = 0;

  async function removePrefix(prefix: string): Promise<void> {
    const { data: entries, error } = await bucket.list(prefix, { limit: 200 });
    if (error || !entries?.length) return;

    const filePaths: string[] = [];
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) {
        filePaths.push(path);
      } else {
        await removePrefix(path);
      }
    }

    if (filePaths.length > 0) {
      const { error: removeErr } = await bucket.remove(filePaths);
      if (!removeErr) removed += filePaths.length;
    }
  }

  await removePrefix(orgId);
  return removed;
}

export async function purgeNodoOperationalData(
  admin: SupabaseClient,
  nodoCode: string,
  provisionUserId: string,
): Promise<PurgeResult> {
  const code = nodoCode.toLowerCase();

  if (code === "inmo" || code === "clínica" || code === "clinica" || code === "salud") {
    const product = code === "inmo" ? "inmo" : "clinica";
    const orgId = await resolveAdminOrgId(admin, provisionUserId, product);
    if (!orgId) {
      throw new Error(
        `No se encontró la organización de ${nodoCode} del usuario administrador. Verificá que el acceso esté provisionado.`,
      );
    }

    const { data: counts, error } = await admin.schema("nodo_inmo").rpc(
      "purge_org_operational_data",
      { p_org_id: orgId },
    );

    if (error) throw new Error(error.message);

    const storage_files_removed = await purgeInmoStorage(admin, orgId);

    return {
      ok: true,
      org_id: orgId,
      user_id: provisionUserId,
      counts: (counts ?? {}) as Record<string, number>,
      storage_files_removed,
    };
  }

  if (code === "finanzas") {
    const { data: counts, error } = await admin.schema("nodo_finanzas_personales").rpc(
      "purge_user_data",
      { p_user_id: provisionUserId },
    );

    if (error) throw new Error(error.message);

    return {
      ok: true,
      user_id: provisionUserId,
      counts: (counts ?? {}) as Record<string, number>,
    };
  }

  throw new Error(
    `El nodo "${nodoCode}" aún no soporta borrado de datos desde el panel.`,
  );
}
