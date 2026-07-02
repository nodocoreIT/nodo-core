/**
 * Reset local admin password + ensure Pro plan (after db reset).
 *   pnpm exec tsx scripts/reset-local-admin.ts
 */
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@nodoinmo.test";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "local-dev-only";

async function main() {
  if (!SERVICE_ROLE_KEY) {
    console.error("Set SUPABASE_SERVICE_ROLE_KEY (supabase status -o json)");
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const sql = postgres(DATABASE_URL, { max: 1 });

  const { data: list, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw listErr;

  let user = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

  if (!user) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      app_metadata: { role: "admin", plan: "pro" },
    });
    if (createErr) throw createErr;
    user = created.user;
    console.log("Created user:", user.id);
  } else {
    const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
      app_metadata: {
        ...(user.app_metadata ?? {}),
        role: user.app_metadata?.role ?? "admin",
        plan: "pro",
      },
    });
    if (updateErr) throw updateErr;
    console.log("Reset password for:", user.id);
  }

  const [membership] = await sql`
    select org_id from shared.org_members
    where user_id = ${user!.id} and role in ('admin', 'super_admin')
    limit 1
  `;

  let orgId = membership?.org_id as string | undefined;

  if (!orgId) {
    const [org] = await sql`
      insert into shared.organizations (name, tier, product)
      values ('Agencia Local Pro', 'pro', 'inmo')
      returning id
    `;
    orgId = org.id as string;
    await sql`
      insert into shared.org_members (org_id, user_id, role)
      values (${orgId}::uuid, ${user!.id}::uuid, 'admin')
      on conflict do nothing
    `;
    console.log("Created org:", orgId);
  } else {
    await sql`update shared.organizations set tier = 'pro' where id = ${orgId}::uuid`;
  }

  await sql`
    insert into shared.nodo_id (org_id, product)
    values (${orgId}::uuid, 'inmo')
    on conflict (org_id, product) do nothing
  `;

  await admin.auth.admin.updateUserById(user!.id, {
    app_metadata: {
      ...(user!.app_metadata ?? {}),
      org_id: orgId,
      role: "admin",
      plan: "pro",
    },
  });

  console.log("\nListo:");
  console.log(`  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  org_id: ${orgId}`);

  await sql.end();
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
