import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { CLINIC_ORG_ID } from "@/lib/clinic/clinic-org";

interface PendingRow {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  verified_at: string | null;
  onboarding_token: string | null;
  next_path: string | null;
}

/** Fase 3 de Recetas — appends `&next=` when the pending row carries a
 * post-onboarding redirect destination. No-op (returns the base URL
 * unchanged) for every other caller, since next_path is null for them. */
function withNextParam(url: URL, nextPath: string | null): URL {
  if (nextPath) url.searchParams.set("next", nextPath);
  return url;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const role = searchParams.get("role");
  const rawOrigin = new URL(request.url).origin;
  const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(rawOrigin);
  const origin = isLocal && process.env.NEXT_PUBLIC_BASE_URL
    ? process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "")
    : rawOrigin;

  if (!token || !role) {
    return NextResponse.redirect(
      new URL(`/registro/${role ?? "medico"}?error=invalid_link`, request.url),
    );
  }

  if (role !== "medico" && role !== "paciente") {
    return NextResponse.redirect(new URL(`/login?error=invalid_link`, request.url));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceClient = (await createServiceClient()) as any;

  const { data: row, error: fetchError } = await serviceClient
    .from("pending_clinic_registrations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (fetchError || !row) {
    return NextResponse.redirect(
      new URL(`/registro/${role}?error=invalid_token`, request.url),
    );
  }

  const pendingRow = row as PendingRow;

  if (pendingRow.verified_at) {
    // Already verified — if onboarding_token exists, let them continue onboarding
    if (pendingRow.onboarding_token) {
      return NextResponse.redirect(
        withNextParam(
          new URL(`/onboarding/${role}?token=${pendingRow.onboarding_token}`, origin),
          pendingRow.next_path,
        ),
      );
    }
    return NextResponse.redirect(new URL(`/login`, origin));
  }

  if (new Date(pendingRow.expires_at) < new Date()) {
    return NextResponse.redirect(
      new URL(`/registro/${role}?error=expired`, request.url),
    );
  }

  if (pendingRow.role !== role) {
    return NextResponse.redirect(new URL(`/login?error=role_mismatch`, request.url));
  }

  const dbRole = role === "medico" ? "medico" : "paciente";

  // Create auth user (ignore if already exists — user may have been created from nodo-landing)
  const { error: createError } = await serviceClient.auth.admin.createUser({
    email: pendingRow.email,
    email_confirm: true,
    app_metadata: { role: dbRole, org_id: CLINIC_ORG_ID },
  });

  if (createError) {
    const msg = (createError.message ?? "").toLowerCase();
    const code = (createError as { code?: string }).code ?? "";
    const alreadyExists =
      msg.includes("already") ||
      msg.includes("exists") ||
      msg.includes("registered") ||
      code === "email_exists" ||
      code === "user_already_exists";

    if (!alreadyExists) {
      console.error("[verify] createUser error", { message: createError.message, code, status: (createError as { status?: number }).status });
      return NextResponse.redirect(new URL(`/login?error=session_error`, request.url));
    }

    // Direct auth.users lookup — O(1), doesn't silently miss users past a
    // fixed listUsers() page like the previous perPage:1000 scan did.
    const { data: existing } = await serviceClient
      .schema("auth")
      .from("users")
      .select("id, raw_app_meta_data")
      .eq("email", pendingRow.email.toLowerCase())
      .maybeSingle();

    if (existing?.id) {
      const current = (existing.raw_app_meta_data as Record<string, unknown>) ?? {};
      // Global user already belongs to a DIFFERENT node's org — never
      // overwrite the role/org_id claim that node depends on.
      const foreign =
        typeof current.org_id === "string" && current.org_id.length > 0 && current.org_id !== CLINIC_ORG_ID;

      if (!foreign) {
        await serviceClient.auth.admin.updateUserById(existing.id, {
          app_metadata: {
            ...current,
            role: dbRole,
            org_id: CLINIC_ORG_ID,
          },
        });
      }
    }
  }

  // Generate onboarding token (UUID) and store it — redirect directly (no Supabase magic link)
  const onboardingToken = crypto.randomUUID();

  await serviceClient
    .from("pending_clinic_registrations")
    .update({
      verified_at: new Date().toISOString(),
      onboarding_token: onboardingToken,
    })
    .eq("id", pendingRow.id);

  // Direct redirect to onboarding page — no Supabase redirectTo needed
  return NextResponse.redirect(
    withNextParam(
      new URL(`/onboarding/${role}?token=${onboardingToken}`, origin),
      pendingRow.next_path,
    ),
  );
}
