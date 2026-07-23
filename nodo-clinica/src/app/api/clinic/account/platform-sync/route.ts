import { NextRequest, NextResponse } from "next/server";
import { readJwtAppMetadata } from "@/lib/nodo/jwt-claims";
import { createClient } from "@/lib/supabase/server";
import { jsonWithSession, type ClinicSession } from "@/lib/clinic/session";
import { isLocalMode } from "@/lib/clinic/config";
import { forbidden, unauthorized } from "@/lib/clinic/access-control";
import { parseClinicDbRole } from "@/lib/clinic/resolve-clinic-role";
import { portalNotRegisteredMessage } from "@/lib/clinic/portal-login-eligibility";

const ORG_DOCTOR_ROLES = new Set(["super_admin", "admin", "medico", "agent"]);

/**
 * Called after Supabase login (platform mode).
 * Upserts the professional row in nodo_clinica.professionals and
 * returns a ClinicSession cookie so clinic API routes can identify the doctor.
 */
export async function POST(_request: NextRequest) {
  if (isLocalMode()) {
    return NextResponse.json(
      { error: "Platform sync no aplica en modo local" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.user?.email) {
    return unauthorized("Iniciá sesión con tu cuenta Nodo");
  }

  const meta = readJwtAppMetadata(session);
  const orgId = typeof meta.org_id === "string" ? meta.org_id : undefined;
  const jwtRole = typeof meta.role === "string" ? meta.role : "";
  const portalRole = parseClinicDbRole(jwtRole);
  const plan = typeof meta.plan === "string" ? meta.plan : "starter";

  if (portalRole === "paciente") {
    return forbidden(
      "Tu cuenta es de paciente. Ingresá desde la pestaña Paciente.",
    );
  }

  const hasOrgDoctorRole = ORG_DOCTOR_ROLES.has(jwtRole);
  if (portalRole !== "medico" && !hasOrgDoctorRole) {
    return forbidden(
      "Tu cuenta no tiene rol de médico en Nodo Clínica. Usá el portal de pacientes.",
    );
  }

  if (!orgId) {
    return forbidden("Tu cuenta no tiene organización asociada.");
  }

  const email = session.user.email.toLowerCase().trim();
  const metaName = session.user.user_metadata?.full_name;
  const displayName =
    (typeof metaName === "string" && metaName.trim()) ||
    email.split("@")[0] ||
    "Médico";

  // 1. Try to find existing professional by user_id (most specific match)
  let { data: professional } = await supabase
    .from("professionals")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();

  // 2. Fall back to email + org (professional existed before linking Supabase account)
  if (!professional) {
    const result = await supabase
      .from("professionals")
      .select("*")
      .eq("org_id", orgId)
      .eq("email", email)
      .maybeSingle();
    professional = result.data;
  }

  if (!professional) {
    return forbidden(portalNotRegisteredMessage("medico"));
  }

  // Returning user — keep data fresh
  const updates: Record<string, unknown> = {
    subscription_plan: plan,
    subscription_status: "active",
    user_id: session.user.id,
  };
  if (!professional.full_name || professional.full_name === "Médico") {
    updates.full_name = displayName;
  }

  const { data: updated } = await supabase
    .from("professionals")
    .update(updates)
    .eq("id", professional.id)
    .select()
    .single();

  if (updated) professional = updated;

  const clinicSession: ClinicSession = {
    userId: professional.id,
    role: "doctor",
    email: professional.email,
    fullName: professional.full_name,
  };

  return jsonWithSession(
    {
      user: professional,
      role: "doctor",
      session: clinicSession,
      platform: { orgId, plan, jwtRole },
    },
    clinicSession,
  );
}
