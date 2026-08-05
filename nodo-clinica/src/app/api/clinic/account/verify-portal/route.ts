import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isLocalMode } from "@/lib/clinic/config";
import { getSessionFromRequest, jsonWithSession, type ClinicSession } from "@/lib/clinic/session";
import {
  canAccessAsRole,
  isProfessionalApproved,
  linkClinicMembershipProfiles,
  lookupClinicMembership,
  parseClinicDbRole,
  toSessionRole,
} from "@/lib/clinic/resolve-clinic-role";
import { repairDashboardPacienteProfile } from "@/lib/clinic/repair-dashboard-profile";
import { portalNotRegisteredMessage } from "@/lib/clinic/portal-login-eligibility";
import { resolveSupabaseAuthUser } from "@/lib/supabase/resolve-auth-user";
import { pendingApprovalResponse } from "@/lib/supabase/auth-guard";

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

  // Same gate as requireAuth() (auth-guard.ts): onboarding complete is NOT
  // "admin approved". This is the page-level entry point médico-admin-layout
  // awaits before rendering the panel, so it must reject here too — relying
  // only on requireAuth() would still flash the panel shell while its data
  // fetches silently 403 in the background.
  if (intendedRole === "medico" && membership.professionalId) {
    if (!isProfessionalApproved(membership)) {
      return pendingApprovalResponse();
    }
  }

  const sessionRole = toSessionRole(intendedRole);

  // Refresh the clinica_session cookie to match the role just verified —
  // otherwise a stale cookie from an earlier login as the OTHER role (a
  // dual patient+médico account switching portals) keeps overriding
  // /api/clinic/account/session's role resolution, silently bouncing this
  // login back to /login even though auth + portal access both succeeded.
  const clinicSession: ClinicSession = {
    userId: user.id,
    role: sessionRole,
    email: user.email ?? "",
    fullName:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email ??
      "",
  };

  return jsonWithSession(
    {
      ok: true,
      role: sessionRole,
      professionalId: membership.professionalId,
      patientId: membership.patientId,
    },
    clinicSession,
  );
}
