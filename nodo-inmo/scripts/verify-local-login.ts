import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY =
  process.env.ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@nodoinmo.test";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "local-dev-only";

async function main() {
  if (!SERVICE_ROLE_KEY) {
    console.error("Set SUPABASE_SERVICE_ROLE_KEY (supabase status)");
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;

  const user = data.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());
  console.log("user:", user ? user.id : "NOT_FOUND");
  if (user) {
    console.log("  confirmed:", Boolean(user.email_confirmed_at));
    console.log("  app_metadata:", JSON.stringify(user.app_metadata));
  }

  const client = createClient(SUPABASE_URL, ANON_KEY);
  const login = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  console.log("login:", login.error?.message ?? "OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
