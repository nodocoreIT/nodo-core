import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/clinic/session";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!error && user) {
    const appMeta = user.app_metadata ?? {};
    const userMeta = user.user_metadata ?? {};
    const rawRole: string = appMeta.role ?? "patient";
    const sessionRole: "doctor" | "patient" = [
      "super_admin",
      "admin",
      "medico",
      "agent",
    ].includes(rawRole)
      ? "doctor"
      : "patient";
    const fullName: string = userMeta.full_name ?? userMeta.name ?? user.email ?? "";

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
        fullName,
        role: sessionRole,
        org_id: appMeta.org_id ?? null,
      },
    });
  }

  // Fallback: check ClinicSession JWT cookie (set by login/platform-sync)
  const clinicSession = await getSession();
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
  return NextResponse.json({ ok: true });
}
