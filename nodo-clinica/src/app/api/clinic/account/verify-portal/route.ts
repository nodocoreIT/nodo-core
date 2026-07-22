import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  canAccessAsRole,
  lookupClinicMembershipByAuthUserId,
  parseClinicDbRole,
  toSessionRole,
} from "@/lib/clinic/resolve-clinic-role";

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

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = await createServiceClient();
  const membership = await lookupClinicMembershipByAuthUserId(
    service,
    user.id,
    user.email,
  );

  if (!canAccessAsRole(membership, intendedRole)) {
    return NextResponse.json(
      {
        error:
          intendedRole === "medico"
            ? "Esta cuenta no tiene acceso al portal médico."
            : "Esta cuenta no está registrada como paciente.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    role: toSessionRole(intendedRole),
    professionalId: membership.professionalId,
    patientId: membership.patientId,
  });
}
