import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/clinic/account/ensure-role
 *
 * Called during the password-setup activation flow. Looks up the authenticated
 * user in professionals or patients and sets app_metadata.role so that
 * subsequent getSession() calls return the correct portal role.
 *
 * Requires an active Supabase session (recovery or regular).
 */
export async function POST(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Determine role by checking which table the user belongs to
  const service = await createServiceClient();

  const { data: professional } = await service
    .from("professionals")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  const role: "medico" | "paciente" = professional ? "medico" : "paciente";

  // Use auth admin to update app_metadata
  const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    user.id,
    { app_metadata: { role } },
  );

  if (updateError) {
    console.error("[ensure-role] updateUserById error", updateError);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, role });
}
