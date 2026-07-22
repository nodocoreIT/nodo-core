import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isLocalMode } from "@/lib/clinic/config";
import { getSession, clearSessionResponse } from "@/lib/clinic/session";
import {
  canAccessAsRole,
  lookupClinicMembershipByAuthUserId,
  resolveRoleForContext,
  sessionRoleToDbRole,
} from "@/lib/clinic/resolve-clinic-role";

export async function GET(): Promise<NextResponse> {
  // Resolve ClinicSession cookie once — used for role preference and as fallback.
  const clinicSession = await getSession();

  if (!isLocalMode()) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      const appMeta = user.app_metadata ?? {};
      const userMeta = user.user_metadata ?? {};
      const fullName: string = userMeta.full_name ?? userMeta.name ?? user.email ?? "";

      const svc = await createServiceClient();
      const membership = await lookupClinicMembershipByAuthUserId(
        svc,
        user.id,
        user.email,
      );
      const defaultResolved = resolveRoleForContext(membership);
      const dbRole = defaultResolved.role;

      const sessionRole: "doctor" | "patient" =
        clinicSession?.role === "patient" &&
        canAccessAsRole(membership, "paciente")
          ? "patient"
          : dbRole === "medico"
            ? "doctor"
            : "patient";

      let resolvedId = clinicSession?.userId ?? user.id;
      if (sessionRole === "doctor") {
        resolvedId = membership.professionalId ?? resolvedId;
        if (!membership.professionalId) {
          const { data: professional } = await svc
            .from("professionals")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (professional) resolvedId = professional.id;
        }
      } else if (membership.patientProfileId) {
        resolvedId = membership.patientProfileId;
      }

      return NextResponse.json({
        session: {
          userId: user.id,
          email: user.email,
          role: sessionRole,
          org_id: appMeta.org_id ?? null,
        },
        user: {
          id: resolvedId,
          email: user.email,
          fullName: clinicSession?.fullName ?? fullName,
          profilePhotoUrl: clinicSession?.profilePhotoUrl,
          role: sessionRole,
          org_id: appMeta.org_id ?? null,
        },
      });
    }
  }

  // Fallback: ClinicSession JWT cookie (set by login / platform-sync routes).
  if (clinicSession) {
    return NextResponse.json({
      session: {
        userId: clinicSession.userId,
        email: clinicSession.email,
        role: clinicSession.role,
        org_id: null,
      },
      user: {
        id: clinicSession.userId,
        email: clinicSession.email,
        fullName: clinicSession.fullName,
        profilePhotoUrl: clinicSession.profilePhotoUrl,
        role: clinicSession.role,
        org_id: null,
      },
    });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(): Promise<NextResponse> {
  if (!isLocalMode()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return clearSessionResponse();
}
