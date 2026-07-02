import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appMeta = user.app_metadata ?? {};
  const userMeta = user.user_metadata ?? {};
  const role: string = appMeta.role ?? "patient";
  const fullName: string = userMeta.full_name ?? userMeta.name ?? user.email ?? "";

  return NextResponse.json({
    session: {
      userId: user.id,
      email: user.email,
      role,
      org_id: appMeta.org_id ?? null,
    },
    user: {
      id: user.id,
      email: user.email,
      fullName,
      role,
      org_id: appMeta.org_id ?? null,
    },
  });
}

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
