import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/clinic/session";
import type { ClinicSession } from "@/lib/clinic/session";
import { resolveSupabaseAuthUser } from "@/lib/supabase/resolve-auth-user";
import { createServiceClient } from "@/lib/supabase/server";
import { lookupClinicMembershipByAuthUserId } from "@/lib/clinic/resolve-clinic-role";

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

  const resolved = await resolveSupabaseAuthUser(request);
  const user = resolved?.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userMeta = user.user_metadata ?? {};
  const fullName: string = userMeta.full_name ?? user.email?.split("@")[0] ?? "";

  // Security: only allow downgrade. A patient-only account cannot become a
  // doctor. Privilege comes from the professionals table (per user_id), not
  // from app_metadata.role — that field is shared across every node this
  // global user might belong to, so a foreign "admin"/"agent" role from
  // another node must never grant doctor access here.
  if (role === "doctor") {
    const service = await createServiceClient();
    const membership = await lookupClinicMembershipByAuthUserId(service, user.id, user.email);
    if (!membership.professionalId) {
      return NextResponse.json({ error: "Not authorized to assume doctor role" }, { status: 403 });
    }
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
