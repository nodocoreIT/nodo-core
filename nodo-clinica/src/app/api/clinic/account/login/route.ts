import { NextRequest, NextResponse } from "next/server";
import { mapAuthLoginError } from "@nodocore/shared-components/lib/verify-node-access";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { jsonWithSession } from "@/lib/clinic/session";
import {
  canAccessAsRole,
  linkClinicMembershipProfiles,
  lookupClinicMembership,
  sessionRoleToDbRole,
} from "@/lib/clinic/resolve-clinic-role";
import { checkPortalLoginEligibility, portalNotRegisteredMessage } from "@/lib/clinic/portal-login-eligibility";

export async function POST(request: NextRequest) {
  try {
    const { email, password, role: requestedRole } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
    }

    const intendedDbRole = sessionRoleToDbRole(
      requestedRole === "doctor" ? "doctor" : "patient",
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceClient = (await createServiceClient()) as any;

    const eligibility = await checkPortalLoginEligibility(
      serviceClient,
      email,
      intendedDbRole,
    );
    if (!eligibility.eligible) {
      return NextResponse.json({ error: eligibility.message }, { status: 404 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return NextResponse.json(
        { error: mapAuthLoginError(error?.message) },
        { status: 401 },
      );
    }
    const membership = await linkClinicMembershipProfiles(
      serviceClient,
      data.user.id,
      await lookupClinicMembership(serviceClient, {
        email: data.user.email,
        authUserId: data.user.id,
      }),
    );

    if (!canAccessAsRole(membership, intendedDbRole)) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: portalNotRegisteredMessage(intendedDbRole) },
        { status: 404 },
      );
    }

    const appMeta = data.user.app_metadata ?? {};

    const sessionRole: "doctor" | "patient" =
      requestedRole === "patient" ? "patient" : "doctor";

    let canonicalName: string | null = null;
    if (sessionRole === "doctor") {
      const { data: professional } = await serviceClient
        .from("professionals")
        .select("full_name")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (!professional) {
        const { data: byEmail } = await serviceClient
          .from("professionals")
          .select("full_name")
          .eq("email", data.user.email?.toLowerCase() ?? "")
          .maybeSingle();
        canonicalName = byEmail?.full_name ?? null;
      } else {
        canonicalName = professional.full_name ?? null;
      }
    } else {
      const { data: patient } = await serviceClient
        .from("patients")
        .select("full_name")
        .eq("profile_id", data.user.id)
        .maybeSingle();
      if (!patient && data.user.email) {
        const { data: byEmail } = await serviceClient
          .from("patients")
          .select("full_name")
          .eq("email", data.user.email.toLowerCase())
          .maybeSingle();
        canonicalName = byEmail?.full_name ?? null;
      } else {
        canonicalName = patient?.full_name ?? null;
      }
    }
    const fullName: string =
      canonicalName ??
      data.user.user_metadata?.full_name ??
      data.user.email?.split("@")[0] ??
      "";

    // Use jsonWithSession so the ClinicSession cookie is set directly on the
    // response object (response.cookies.set), which is the only reliable way
    // to set cookies in a Next.js Route Handler.
    return jsonWithSession(
      {
        user: {
          id: data.user.id,
          email: data.user.email,
          fullName,
          role: sessionRole,
          org_id: appMeta.org_id ?? null,
        },
        role: sessionRole,
        supabaseSession: data.session
          ? {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            }
          : null,
      },
      {
        userId: data.user.id,
        role: sessionRole,
        email: data.user.email!,
        fullName,
      },
    );
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al ingresar. Reintentá." },
      { status: 500 },
    );
  }
}
