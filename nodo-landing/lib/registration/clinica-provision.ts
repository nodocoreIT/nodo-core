import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";

const DEFAULT_CLINIC_ORG_ID = "843524dc-0c3b-4340-bc8e-e3ae5aa00fd2";

/** Maps panel plan codes (and legacy values) to the clinica portal role. */
export function clinicaPortalRoleFromPlan(plan: string): "medico" | "paciente" {
  const p = plan.trim().toLowerCase();

  if (
    p.includes("medico") ||
    p.includes("médico") ||
    p.includes("turnero") ||
    p.includes("institucional") ||
    p === "profesional"
  ) {
    return "medico";
  }

  if (
    p.includes("paciente") ||
    p.includes("salud") ||
    p === "starter" ||
    p === "paciente"
  ) {
    return "paciente";
  }

  // medico_pro_clinica, turnero_* → medico; paciente_libre_* → paciente
  if (p.endsWith("_clinica")) {
    if (p.startsWith("medico") || p.startsWith("turnero")) return "medico";
    return "paciente";
  }

  return "paciente";
}

function splitName(fullName: string, email: string) {
  const trimmed = fullName.trim();
  const parts = trimmed ? trimmed.split(/\s+/) : [];
  const firstName = parts[0] ?? email.split("@")[0] ?? "Usuario";
  const lastName = parts.slice(1).join(" ") || firstName;
  const display = trimmed || `${firstName} ${lastName}`.trim();
  return { firstName, lastName, display };
}

/**
 * Ensures nodo_clinica.patients or professionals exists for dashboard-provisioned users.
 * Without this row, login on the patient tab fails and the medico tab may auto-create
 * a professional via platform-sync (wrong role).
 */
export async function ensureClinicaPortalProfile(params: {
  userId: string;
  email: string;
  clientName: string;
  orgId: string;
  plan: string;
  portalRole: "medico" | "paciente";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createNodoAdminClient("clinica");
  if (!admin) {
    return { ok: false, error: "Nodo Clínica no configurado." };
  }

  const db = admin.schema("nodo_clinica");
  const email = params.email.trim().toLowerCase();
  const orgId = params.orgId || process.env.CLINIC_ORG_ID || DEFAULT_CLINIC_ORG_ID;
  const { firstName, lastName, display } = splitName(params.clientName, email);

  if (params.portalRole === "paciente") {
    const { data: existing, error: fetchError } = await db
      .from("patients")
      .select("id, profile_id")
      .eq("email", email)
      .maybeSingle();

    if (fetchError) {
      return { ok: false, error: fetchError.message };
    }

    if (existing) {
      if (!existing.profile_id) {
        await db
          .from("patients")
          .update({ profile_id: params.userId })
          .eq("id", existing.id);
      }
      return { ok: true };
    }

    const { error: insertError } = await db.from("patients").insert({
      profile_id: params.userId,
      org_id: orgId,
      first_name: firstName,
      last_name: lastName,
      full_name: display,
      email,
      subscription_plan: params.plan,
    });

    if (insertError && insertError.code !== "23505") {
      return { ok: false, error: insertError.message };
    }

    return { ok: true };
  }

  const { data: existing, error: fetchError } = await db
    .from("professionals")
    .select("id, user_id")
    .eq("email", email)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }

  if (existing) {
    if (!existing.user_id) {
      await db
        .from("professionals")
        .update({ user_id: params.userId })
        .eq("id", existing.id);
    }
    return { ok: true };
  }

  const { error: insertError } = await db.from("professionals").insert({
    user_id: params.userId,
    org_id: orgId,
    first_name: firstName,
    last_name: lastName,
    full_name: display,
    email,
    subscription_status: "active",
    subscription_plan: params.plan,
  });

  if (insertError && insertError.code !== "23505") {
    return { ok: false, error: insertError.message };
  }

  return { ok: true };
}

function isClinicaUnitCode(unitCode: string): boolean {
  const code = unitCode.trim().toLowerCase();
  return code === "clínica" || code === "clinica" || code === "salud";
}

/** Removes clinica portal rows so verify-portal / login cannot succeed after revoke. */
export async function revokeClinicaPortalAccess(params: {
  email?: string | null;
  userId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createNodoAdminClient("clinica");
  if (!admin) return { ok: true };

  const db = admin.schema("nodo_clinica");
  const email = params.email?.trim().toLowerCase() ?? null;
  const userId = params.userId ?? null;

  async function removePatientRows() {
    if (userId) {
      const { error } = await db.from("patients").delete().eq("profile_id", userId);
      if (error && error.code !== "23503") return error.message;
      if (error?.code === "23503") {
        await db
          .from("patients")
          .update({ profile_id: null, email: `revoked+${userId.slice(0, 8)}@deleted.local` })
          .eq("profile_id", userId);
      }
    }
    if (email) {
      const { error } = await db.from("patients").delete().eq("email", email);
      if (error && error.code !== "23503") return error.message;
      if (error?.code === "23503") {
        await db
          .from("patients")
          .update({ profile_id: null, email: `revoked+${Date.now()}@deleted.local` })
          .eq("email", email);
      }
    }
    return null;
  }

  async function removeProfessionalRows() {
    if (userId) {
      const { error } = await db.from("professionals").delete().eq("user_id", userId);
      if (error && error.code !== "23503") return error.message;
      if (error?.code === "23503") {
        await db
          .from("professionals")
          .update({ user_id: null, email: `revoked+${userId.slice(0, 8)}@deleted.local` })
          .eq("user_id", userId);
      }
    }
    if (email) {
      const { error } = await db.from("professionals").delete().eq("email", email);
      if (error && error.code !== "23503") return error.message;
      if (error?.code === "23503") {
        await db
          .from("professionals")
          .update({ user_id: null, email: `revoked+${Date.now()}@deleted.local` })
          .eq("email", email);
      }
    }
    return null;
  }

  const patientErr = await removePatientRows();
  if (patientErr) return { ok: false, error: patientErr };

  const profErr = await removeProfessionalRows();
  if (profErr) return { ok: false, error: profErr };

  return { ok: true };
}

export { isClinicaUnitCode };
