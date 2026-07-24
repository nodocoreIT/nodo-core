import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isLocalMode } from "@/lib/clinic/config";
import { readDb } from "@/lib/clinic/local-db";
import {
  checkPortalLoginEligibility,
  parsePortalLoginRole,
  portalNotRegisteredMessage,
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

  if (isLocalMode()) {
    const emailLower = email.toLowerCase().trim();
    if (!emailLower) {
      return NextResponse.json(
        { eligible: false, error: portalNotRegisteredMessage(role) },
        { status: 404 },
      );
    }
    const db = await readDb();
    const eligible =
      role === "medico"
        ? db.doctors.some((d) => d.email === emailLower)
        : db.patients.some((p) => p.email === emailLower);
    if (!eligible) {
      return NextResponse.json(
        { eligible: false, error: portalNotRegisteredMessage(role) },
        { status: 404 },
      );
    }
    return NextResponse.json({ eligible: true });
  }

  const service = await createServiceClient();
  const result = await checkPortalLoginEligibility(service, email, role);

  if (!result.eligible) {
    return NextResponse.json({ eligible: false, error: result.message }, { status: 404 });
  }

  return NextResponse.json({ eligible: true });
}
