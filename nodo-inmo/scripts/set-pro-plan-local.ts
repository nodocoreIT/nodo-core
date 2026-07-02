/**
 * Marca una org + usuario admin como Plan Pro (desarrollo local).
 * Crea shared.nodo_id si falta.
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role> \
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *   ADMIN_EMAIL=admin@nodoinmo.test \
 *   npx tsx scripts/set-pro-plan-local.ts
 */

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`ERROR: required env var ${name} is not set.`);
    process.exit(1);
  }
  return val;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const DATABASE_URL = requireEnv("DATABASE_URL");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@nodoinmo.test";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(DATABASE_URL, { max: 1 });

async function main() {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw listErr;

  const user = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  if (!user) {
    console.error(`No user found with email ${ADMIN_EMAIL}. Run bootstrap-admin.ts first.`);
    process.exit(1);
  }

  const [membership] = await sql`
    select om.org_id, o.tier, o.product
    from shared.org_members om
    join shared.organizations o on o.id = om.org_id
    where om.user_id = ${user.id}
      and om.role in ('admin', 'super_admin')
    limit 1
  `;

  if (!membership) {
    console.error("User has no admin org membership. Run bootstrap-admin.ts first.");
    process.exit(1);
  }

  const orgId = membership.org_id as string;
  const product = (membership.product as string) || "inmo";

  await sql`
    update shared.organizations
    set tier = 'pro'
    where id = ${orgId}::uuid
  `;

  await sql`
    insert into shared.nodo_id (org_id, product)
    values (${orgId}::uuid, ${product})
    on conflict (org_id, product) do nothing
  `;

  const [nodoId] = await sql`
    select id from shared.nodo_id
    where org_id = ${orgId}::uuid and product = ${product}
    limit 1
  `;

  const currentMeta = user.app_metadata ?? {};
  const { error: authErr } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...currentMeta,
      org_id: orgId,
      role: currentMeta.role ?? "admin",
      plan: "pro",
    },
  });
  if (authErr) throw authErr;

  console.log("\nPlan Pro activado:");
  console.log(`  email    : ${ADMIN_EMAIL}`);
  console.log(`  user_id  : ${user.id}`);
  console.log(`  org_id   : ${orgId}`);
  console.log(`  nodo_id  : ${nodoId?.id ?? "(pending)"}`);
  console.log("\nCerrá sesión y volvé a entrar para refrescar el JWT.");
}

main()
  .catch((err) => {
    console.error("\nFailed:", err.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end();
  });
