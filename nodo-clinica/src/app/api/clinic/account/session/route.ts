import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isLocalMode } from "@/lib/clinic/config";
import { getSession, clearSessionResponse } from "@/lib/clinic/session";
import {
  canAccessAsRole,
  lookupClinicMembershipByAuthUserId,
} from "@/lib/clinic/resolve-clinic-role";
import { resolveSupabaseAuthUser } from "@/lib/supabase/resolve-auth-user";
import { trialDaysRemaining } from "@/lib/clinic/trial";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const [clinicSession, resolved] = await Promise.all([
    getSession(),
    !isLocalMode()
      ? resolveSupabaseAuthUser(request)
      : Promise.resolve(null as Awaited<ReturnType<typeof resolveSupabaseAuthUser>>),
  ]);

  if (!isLocalMode()) {
    if (resolved) {
      const { user } = resolved;
      const appMeta = user.app_metadata ?? {};
      const userMeta = user.user_metadata ?? {};
      const fullName: string = userMeta.full_name ?? userMeta.name ?? user.email ?? "";

      const svc = await createServiceClient();
      const membership = await lookupClinicMembershipByAuthUserId(
        svc,
        user.id,
        user.email,
      );

      const canDoctor = canAccessAsRole(membership, "medico");
      const canPatient = canAccessAsRole(membership, "paciente");

      if (!canDoctor && !canPatient) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      let sessionRole: "doctor" | "patient";
      if (clinicSession?.role === "patient" && canPatient) {
        sessionRole = "patient";
      } else if (canDoctor) {
        sessionRole = "doctor";
      } else {
        sessionRole = "patient";
      }

      let resolvedId = clinicSession?.userId ?? user.id;
      if (sessionRole === "doctor") {
        resolvedId = membership.professionalId ?? resolvedId;
      } else if (membership.patientProfileId) {
        resolvedId = membership.patientProfileId;
      }

      let subscriptionPlan: string | undefined;
      let subscriptionStatus: string | undefined;
      let trialDays: number | undefined;
      if (sessionRole === "doctor" && resolvedId) {
        const { data: professional } = await svc
          .from("professionals")
          .select("subscription_plan, subscription_status, trial_ends_at")
          .eq("id", resolvedId)
          .maybeSingle();
        if (professional) {
          const prof = professional as unknown as {
            subscription_plan: string | null;
            subscription_status: string | null;
            trial_ends_at: string | null;
          };
          subscriptionPlan = prof.subscription_plan ?? undefined;
          subscriptionStatus = prof.subscription_status ?? undefined;
          trialDays = trialDaysRemaining(prof.trial_ends_at);
        }
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
          subscriptionPlan,
          subscriptionStatus,
          trialDaysRemaining: trialDays,
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
