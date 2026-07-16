import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setSession } from "@/lib/clinic/session";
import type { ClinicSession } from "@/lib/clinic/session";

/**
 * POST /api/clinic/auth/set-role
 * Body: { role: "patient" | "doctor" }
 *
 * Reads the current Supabase session to verify the user is authenticated,
 * then writes a ClinicSession cookie reflecting the chosen role.
 *
 * Only allows downgrade (doctor → patient). A "patient" Supabase user cannot
 * elevate to "doctor" through this endpoint.
 */
export async function POST(request: NextRequest) {
  const { role } = (await request.json()) as { role?: string };

  if (role !== "patient" && role !== "doctor") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appMeta = user.app_metadata ?? {};
  const userMeta = user.user_metadata ?? {};
  const fullName: string = userMeta.full_name ?? user.email?.split("@")[0] ?? "";

  // Security: only allow downgrade. A patient-only account cannot become a doctor.
  const supabaseRole: string = appMeta.role ?? "patient";
  const isPrivileged = ["doctor", "medico", "admin", "super_admin", "agent"].includes(supabaseRole);

  if (role === "doctor" && !isPrivileged) {
    return NextResponse.json({ error: "Not authorized to assume doctor role" }, { status: 403 });
  }

  const session: ClinicSession = {
    userId: user.id,
    role,
    email: user.email ?? "",
    fullName,
  };

  await setSession(session);

  return NextResponse.json({ ok: true, role });
}
