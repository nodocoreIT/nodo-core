import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isLocalMode } from "@/lib/clinic/config";
import { getSessionFromRequest } from "@/lib/clinic/session";
import {
  canAccessAsRole,
  linkClinicMembershipProfiles,
  lookupClinicMembership,
  parseClinicDbRole,
  toSessionRole,
} from "@/lib/clinic/resolve-clinic-role";
import { repairDashboardPacienteProfile } from "@/lib/clinic/repair-dashboard-profile";
import { portalNotRegisteredMessage } from "@/lib/clinic/portal-login-eligibility";
import { resolveSupabaseAuthUser } from "@/lib/supabase/resolve-auth-user";

/**
 * POST /api/clinic/account/verify-portal
 * Body: { role: "medico" | "paciente" | "doctor" | "patient" }
 *
 * Verifies the current Supabase session may access the requested portal.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const intendedRole = parseClinicDbRole(body.role);
  if (!intendedRole) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (isLocalMode()) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const intendedSessionRole = toSessionRole(intendedRole);
    if (session.role !== intendedSessionRole) {
      return NextResponse.json(
        { error: portalNotRegisteredMessage(intendedRole) },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      role: session.role,
      professionalId: session.role === "doctor" ? session.userId : undefined,
      patientId: session.role === "patient" ? session.userId : undefined,
    });
  }

  const resolved = await resolveSupabaseAuthUser(request);
  const user = resolved?.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = await createServiceClient();
  let membership = await lookupClinicMembership(service, {
    email: user.email,
    authUserId: user.id,
  });
  membership = await linkClinicMembershipProfiles(service, user.id, membership);

  if (!canAccessAsRole(membership, intendedRole) && intendedRole === "paciente") {
    const repaired = await repairDashboardPacienteProfile(service, user, { force: true });
    if (repaired) {
      membership = await linkClinicMembershipProfiles(service, user.id, repaired);
    }
  }

  if (!canAccessAsRole(membership, intendedRole)) {
    return NextResponse.json(
      { error: portalNotRegisteredMessage(intendedRole) },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    role: toSessionRole(intendedRole),
    professionalId: membership.professionalId,
    patientId: membership.patientId,
  });
}
