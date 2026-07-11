import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession, clearSessionResponse } from "@/lib/clinic/session";

export async function GET(): Promise<NextResponse> {
  // Resolve ClinicSession cookie once — used for role preference and as fallback.
  const clinicSession = await getSession();

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

    // Prefer the role recorded in the ClinicSession cookie (set at login time).
    // This preserves the portal the user chose (e.g. patient portal for an admin).
    // The cookie userId may be professionals.id (≠ auth uid) for doctors; in that
    // case the comparison is false and we fall back to the app_metadata role.
    const sessionRole: "doctor" | "patient" =
      clinicSession?.userId === user.id ? clinicSession.role : appRole;

    return NextResponse.json({
      session: {
        userId: user.id,
        email: user.email,
        role: sessionRole,
        org_id: appMeta.org_id ?? null,
      },
      user: {
        id: user.id,
        email: user.email,
        fullName: clinicSession?.fullName ?? fullName,
        role: sessionRole,
        org_id: appMeta.org_id ?? null,
      },
    });
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
        role: clinicSession.role,
        org_id: null,
      },
    });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // clearSessionResponse uses response.cookies.delete — reliable in Route Handlers
  return clearSessionResponse();
}
