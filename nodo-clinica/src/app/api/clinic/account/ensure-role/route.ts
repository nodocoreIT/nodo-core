import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/clinic/account/ensure-role
 *
 * Called during the password-setup activation flow BEFORE re-login.
 * Accepts { email } in body, looks up the user in professionals/patients,
 * and sets app_metadata.role via the service role key.
 *
 * Does NOT require an active session — the recovery session is consumed
 * by updateUser() before this runs.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const service = await createServiceClient();

  // Determine role by checking which table the user belongs to
  const { data: professional } = await service
    .from("professionals")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  const role: "medico" | "paciente" = professional ? "medico" : "paciente";

  // Resolve auth user ID: prefer user_id from professionals table,
  // fall back to looking up patients, then listing auth users.
  let authUserId: string | null = professional?.user_id ?? null;

  if (!authUserId) {
    const { data: patient } = await service
      .from("patients")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();
    authUserId = patient?.user_id ?? null;
  }

  // Last resort: find by email in auth.users
  const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  if (!authUserId) {
    const { data: listData } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = listData?.users?.find((u: any) => u.email === email);
    authUserId = found?.id ?? null;
  }

  if (!authUserId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    authUserId,
    { app_metadata: { role } },
  );

  if (updateError) {
    console.error("[ensure-role] updateUserById error", updateError);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, role });
}
