import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const role: string = appMeta.role ?? "patient";

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        role,
        org_id: appMeta.org_id ?? null,
      },
      role,
    });
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al ingresar. Reintentá." },
      { status: 500 },
    );
  }
}
