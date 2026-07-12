import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

interface PendingRow {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  verified_at: string | null;
  onboarding_token: string | null;
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
        new URL(`/onboarding/${role}?token=${pendingRow.onboarding_token}`, origin),
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

  // Create auth user (ignore if already exists — user may have been created from nodo-landing)
  const { error: createError } = await serviceClient.auth.admin.createUser({
    email: pendingRow.email,
    email_confirm: true,
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
    new URL(`/onboarding/${role}?token=${onboardingToken}`, origin),
  );
}
