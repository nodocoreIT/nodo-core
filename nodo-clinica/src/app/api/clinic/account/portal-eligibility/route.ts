import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  checkPortalLoginEligibility,
  parsePortalLoginRole,
} from "@/lib/clinic/portal-login-eligibility";

/**
 * POST /api/clinic/account/portal-eligibility
 * Body: { email, role: "medico" | "paciente" | "doctor" | "patient" }
 *
 * Checks whether the email has a portal profile before attempting auth.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  const role = parsePortalLoginRole(body.role);

  if (!role) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const service = await createServiceClient();
  const result = await checkPortalLoginEligibility(service, email, role);

  if (!result.eligible) {
    return NextResponse.json({ eligible: false, error: result.message }, { status: 404 });
  }

  return NextResponse.json({ eligible: true });
}
