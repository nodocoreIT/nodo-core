import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isLocalMode } from "@/lib/clinic/config";
import { getSession, clearSessionResponse } from "@/lib/clinic/session";

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
      const rawRole: string = appMeta.role ?? "patient";
      const isPrivileged = ["super_admin", "admin", "medico", "agent"].includes(rawRole);
      const appRole: "doctor" | "patient" = isPrivileged ? "doctor" : "patient";
      const fullName: string = userMeta.full_name ?? userMeta.name ?? user.email ?? "";

      const sessionRole: "doctor" | "patient" =
        clinicSession?.userId === user.id ? clinicSession.role : appRole;

      // clinicSession.userId is always resolved to professionals.id (the PK
      // appointments.doctor_id points to) by validateSessionUser(), never the
      // raw Supabase Auth user id — auth.getUser()'s id is professionals.user_id,
      // a different column entirely. Falling back to it silently would hand
      // callers the wrong id for any query keyed on the doctor. When there is
      // no ClinicSession cookie at all (e.g. a doctor who only ever
      // authenticated via the Supabase Auth SDK directly), resolve it here.
      let resolvedId = clinicSession?.userId ?? user.id;
      if (!clinicSession && sessionRole === "doctor") {
        const svc = await createServiceClient();
        const { data: professional } = await svc
          .from("professionals")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (professional) resolvedId = professional.id;
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
