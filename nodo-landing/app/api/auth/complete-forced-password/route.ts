import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import { setAuthUserPassword } from "@/lib/registration/client-unit-auth";
import { mapAuthPasswordError, isSamePasswordAuthError } from "@nodocore/shared-components/lib/auth-password-errors";
const NODO_CODES = ["inmo", "autos", "finanzas", "clinica"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = ReturnType<typeof createAdminClient> | any;

/**
 * Resolve the authenticated user and the admin client that owns them.
 * The Bearer token may belong to the landing project OR any nodo project,
 * so we try each one until we find a match.
 */
async function resolveAuthenticatedUser(
  request: NextRequest,
): Promise<{ userId: string; admin: AnyAdmin } | null> {
  const bearer = request.headers.get("authorization");
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7).trim() : null;

  if (token) {
    // Try landing project first
    const landingAdmin = createAdminClient();
    const { data, error } = await landingAdmin.auth.getUser(token);
    if (!error && data.user) {
      return { userId: data.user.id, admin: landingAdmin };
    }

    // Try each nodo project (user may live in a separate Supabase project)
    for (const code of NODO_CODES) {
      const nodoAdmin = createNodoAdminClient(code);
      if (!nodoAdmin) continue;
      const { data: nd, error: ne } = await nodoAdmin.auth.getUser(token);
      if (!ne && nd.user) {
        return { userId: nd.user.id, admin: nodoAdmin };
      }
    }

    // Bearer token was present but no project recognized it — fail securely
    return null;
  }

  // Cookie fallback (only when NO Bearer token was supplied)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return { userId: user.id, admin: createAdminClient() };
  }

  return null;
}

export async function POST(request: NextRequest) {
  const auth = await resolveAuthenticatedUser(request);
  if (!auth) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { userId, admin: ownerAdmin } = auth;

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

  const { data: authUser } = await ownerAdmin.auth.admin.getUserById(userId);
  if (!authUser.user) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  const updated = await setAuthUserPassword(ownerAdmin, userId, password, {
    mustSetPassword: false,
    currentAppMetadata: authUser.user.app_metadata ?? {},
  });

  if (!updated.ok) {
    if (isSamePasswordAuthError(updated.error)) {
      const { error: metaErr } = await ownerAdmin.auth.admin.updateUserById(userId, {
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

  // Update client_units in the landing database
  const landingAdmin = createAdminClient();
  const email = authUser.user.email?.toLowerCase();
  if (email) {
    await landingAdmin
      .from("client_units")
      .update({
        access_password: password,
        password_set_at: new Date().toISOString(),
      })
      .eq("provision_user_id", userId);

    await landingAdmin
      .from("client_units")
      .update({
        access_password: password,
        password_set_at: new Date().toISOString(),
      })
      .ilike("access_user", email);
  }

  return NextResponse.json({ ok: true });
}
