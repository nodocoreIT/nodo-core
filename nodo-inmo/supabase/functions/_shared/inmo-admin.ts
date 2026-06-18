import type postgres from "npm:postgres@3";

/** Authorize inmo admin via DB — JWT hook claims are not on auth.users.app_metadata. */
export async function resolveInmoAdminOrgId(
  sql: postgres.Sql,
  userId: string,
): Promise<string | null> {
  const rows = await sql`
    SELECT om.org_id::text AS org_id
    FROM shared.org_members om
    JOIN shared.organizations o ON o.id = om.org_id
    WHERE om.user_id = ${userId}::uuid
      AND o.product IN ('inmo', 'nodo-inmo')
      AND om.role = 'admin'
    LIMIT 1
  `;
  return rows[0]?.org_id ?? null;
}

export async function findAuthUserIdByEmail(
  sql: postgres.Sql,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const rows = await sql`
    SELECT id::text AS id
    FROM auth.users
    WHERE lower(email) = ${normalized}
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

export async function isOrgMember(
  sql: postgres.Sql,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM shared.org_members
    WHERE org_id = ${orgId}::uuid
      AND user_id = ${userId}::uuid
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function upsertOrgMember(
  sql: postgres.Sql,
  orgId: string,
  userId: string,
  dbRole: string,
): Promise<void> {
  await sql`
    INSERT INTO shared.org_members (org_id, user_id, role)
    VALUES (${orgId}::uuid, ${userId}::uuid, ${dbRole})
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role
  `;
}

export async function getOrgName(
  sql: postgres.Sql,
  orgId: string,
): Promise<string> {
  const rows = await sql`
    SELECT name
    FROM shared.organizations
    WHERE id = ${orgId}::uuid
    LIMIT 1
  `;
  return rows[0]?.name ?? "tu inmobiliaria";
}
