import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setAuthUserPassword } from "@/lib/registration/client-unit-auth";
import { mapAuthPasswordError, isSamePasswordAuthError } from "@nodocore/shared-components/lib/auth-password-errors";

async function resolveAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    const token = bearer.slice(7).trim();
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(token);
    if (!error && data.user) return data.user.id;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function POST(request: NextRequest) {
  const userId = await resolveAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const password = String(body.password ?? "").trim();
  const confirmPassword = String(body.confirmPassword ?? "").trim();

  if (password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 },
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Las contraseñas no coinciden." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  if (!authUser.user) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  if (authUser.user.app_metadata?.must_set_password !== true) {
    return NextResponse.json(
      { error: "Tu cuenta no requiere cambio de contraseña." },
      { status: 400 },
    );
  }

  const updated = await setAuthUserPassword(admin, userId, password, {
    mustSetPassword: false,
    currentAppMetadata: authUser.user.app_metadata ?? {},
  });

  if (!updated.ok) {
    if (isSamePasswordAuthError(updated.error)) {
      const { error: metaErr } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: {
          ...(authUser.user.app_metadata ?? {}),
          must_set_password: false,
        },
      });
      if (metaErr) {
        return NextResponse.json({ error: mapAuthPasswordError(metaErr.message) }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: mapAuthPasswordError(updated.error) }, { status: 400 });
    }
  }

  const email = authUser.user.email?.toLowerCase();
  if (email) {
    await admin
      .from("client_units")
      .update({
        access_password: password,
        password_set_at: new Date().toISOString(),
      })
      .eq("provision_user_id", userId);

    await admin
      .from("client_units")
      .update({
        access_password: password,
        password_set_at: new Date().toISOString(),
      })
      .ilike("access_user", email);
  }

  return NextResponse.json({ ok: true });
}
