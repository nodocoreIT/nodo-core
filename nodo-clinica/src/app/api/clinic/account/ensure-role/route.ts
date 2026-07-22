import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  canAccessAsRole,
  lookupClinicMembership,
  parseClinicDbRole,
  resolveRoleForContext,
  type ClinicDbRole,
} from "@/lib/clinic/resolve-clinic-role";

/**
 * POST /api/clinic/account/ensure-role
 *
 * Password recovery: sets app_metadata.role and links patient/professional rows.
 * Body: { email?, userId?, intendedRole: "medico" | "paciente" }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const userIdFromBody =
    typeof body.userId === "string" && body.userId.trim()
      ? body.userId.trim()
      : null;
  let intendedRole =
    parseClinicDbRole(body.intendedRole) ??
    parseClinicDbRole(body.role) ??
    null;

  if (!email && !userIdFromBody) {
    return NextResponse.json(
      { error: "email or userId is required" },
      { status: 400 },
    );
  }

  const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  let authUserId = userIdFromBody;

  if (!authUserId && email) {
    const { data: listData } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = listData?.users?.find(
      (u: any) => String(u.email ?? "").toLowerCase() === email,
    );
    authUserId = found?.id ?? null;
  }

  if (!authUserId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: existingAuthUser } = await adminClient.auth.admin.getUserById(authUserId);
  const currentAppMetadata = existingAuthUser?.user?.app_metadata ?? {};

  if (!intendedRole) {
    intendedRole =
      parseClinicDbRole(currentAppMetadata.role as string | undefined) ??
      "paciente";
  }

  const service = await createServiceClient();

  const membership = await lookupClinicMembership(service, {
    email: email || null,
    authUserId,
  });

  let effectiveRole = intendedRole;

  if (!canAccessAsRole(membership, effectiveRole)) {
    const metaRole = parseClinicDbRole(currentAppMetadata.role as string | undefined);
    if (metaRole && canAccessAsRole(membership, metaRole)) {
      effectiveRole = metaRole;
    } else if (membership.professionalId && !membership.patientId) {
      effectiveRole = "medico";
    } else if (membership.patientId && !membership.professionalId) {
      effectiveRole = "paciente";
    } else if (!membership.professionalId && !membership.patientId) {
      return NextResponse.json(
        {
          error:
            "Tu perfil aún no está creado. Completá el onboarding desde el link de verificación de email antes de configurar la contraseña.",
        },
        { status: 403 },
      );
    } else {
      const msg =
        effectiveRole === "medico"
          ? "Esta cuenta no está registrada como profesional."
          : "Esta cuenta no está registrada como paciente.";
      return NextResponse.json({ error: msg }, { status: 403 });
    }
  }

  const resolved = resolveRoleForContext(membership, effectiveRole);
  const role: ClinicDbRole = resolved.role;

  if (resolved.patientId && !resolved.patientProfileId) {
    await service
      .from("patients")
      .update({ profile_id: authUserId })
      .eq("id", resolved.patientId);
  }

  if (
    resolved.professionalId &&
    resolved.professionalUserId !== authUserId
  ) {
    await service
      .from("professionals")
      .update({ user_id: authUserId })
      .eq("id", resolved.professionalId)
      .is("user_id", null);
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    authUserId,
    {
      app_metadata: {
        ...currentAppMetadata,
        role,
        must_set_password: false,
      },
    },
  );

  if (updateError) {
    console.error("[ensure-role] updateUserById error", updateError);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }

  if (email) {
    await service
      .from("pending_clinic_registrations")
      .delete()
      .eq("email", email);
  }

  return NextResponse.json({ ok: true, role });
}
