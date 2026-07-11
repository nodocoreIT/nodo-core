import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonWithSession } from "@/lib/clinic/session";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const appMeta = data.user.app_metadata ?? {};
    const rawRole: string = appMeta.role ?? "patient";
    const fullName: string =
      data.user.user_metadata?.full_name ?? data.user.email?.split("@")[0] ?? "";

    // Map platform roles to the two clinic session roles
    const sessionRole: "doctor" | "patient" = ["super_admin", "admin", "medico", "agent"].includes(
      rawRole,
    )
      ? "doctor"
      : "patient";

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
