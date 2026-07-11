import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

interface PendingRow {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  verified_at: string | null;
  created_at: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const role = searchParams.get("role");

  // Validate presence of required params
  if (!token || !role) {
    const fallbackRole = role ?? "medico";
    return NextResponse.redirect(
      new URL(`/registro/${fallbackRole}?error=invalid_link`, request.url),
    );
  }

  if (role !== "medico" && role !== "paciente") {
    return NextResponse.redirect(
      new URL(`/login?error=invalid_link`, request.url),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceClient = (await createServiceClient()) as any;

  // Fetch the pending row by token
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

  // Already used
  if (pendingRow.verified_at) {
    return NextResponse.redirect(
      new URL(`/registro/${role}?error=already_used`, request.url),
    );
  }

  // Expired
  if (new Date(pendingRow.expires_at) < new Date()) {
    return NextResponse.redirect(
      new URL(`/registro/${role}?error=expired`, request.url),
    );
  }

  // Role mismatch between query param and stored role
  if (pendingRow.role !== role) {
    return NextResponse.redirect(
      new URL(`/login?error=role_mismatch`, request.url),
    );
  }

  // Create auth user (admin API creates a confirmed user without email loop)
  const realServiceClient = await createServiceClient();
  const { error: createError } = await realServiceClient.auth.admin.createUser({
    email: pendingRow.email,
    email_confirm: true,
  });

  if (createError) {
    const msg = createError.message.toLowerCase();
    const isAlreadyExists =
      msg.includes("already registered") ||
      msg.includes("email already") ||
      msg.includes("user already exists");

    if (!isAlreadyExists) {
      console.error("[verify] createUser error", createError);
      return NextResponse.redirect(
        new URL(`/login?error=session_error`, request.url),
      );
    }
    // User already exists — treat as success and continue to generate magic link
  }

  // Mark token as verified
  await serviceClient
    .from("pending_clinic_registrations")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", pendingRow.id);

  // Generate magic link so the browser gets a real session cookie, then is
  // redirected to the role-specific onboarding page.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const { data: linkData, error: linkError } =
    await realServiceClient.auth.admin.generateLink({
      type: "magiclink",
      email: pendingRow.email,
      options: {
        redirectTo: `${baseUrl}/onboarding/${pendingRow.role}`,
      },
    });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[verify] generateLink error", linkError);
    return NextResponse.redirect(
      new URL(`/login?error=session_error`, request.url),
    );
  }

  // Redirect the browser to the Supabase action_link, which sets the session
  // cookie via /auth/v1/verify and then follows redirectTo to /onboarding/{role}.
  return NextResponse.redirect(linkData.properties.action_link);
}
