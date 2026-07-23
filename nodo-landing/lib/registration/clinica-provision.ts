import type { SupabaseClient } from "@supabase/supabase-js";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";

export const DEFAULT_CLINIC_ORG_ID = "843524dc-0c3b-4340-bc8e-e3ae5aa00fd2";

export function getDefaultClinicOrgId(): string {
  return process.env.CLINIC_ORG_ID ?? DEFAULT_CLINIC_ORG_ID;
}

/** Pacientes y médicos del portal comparten la org de plataforma — no una org por persona. */
export async function ensureClinicaSharedOrgMembership(
  admin: SupabaseClient<any, any, any>,
  params: {
    userId: string;
    clientName: string;
    email: string;
    portalRole?: "medico" | "paciente";
  },
): Promise<{ ok: true; orgId: string } | { ok: false; error: string }> {
  const orgId = getDefaultClinicOrgId();
  const fullName =
    params.clientName.trim() || params.email.trim() || "Usuario";

  const { error: profileError } = await admin
    .schema("shared")
    .from("user_profiles")
    .upsert({ id: params.userId, full_name: fullName }, { onConflict: "id" });

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  if (params.portalRole === "medico") {
    const { error: memberError } = await admin
      .schema("shared")
      .from("org_members")
      .insert({ user_id: params.userId, org_id: orgId, role: "admin" });

    if (memberError && memberError.code !== "23505") {
      return { ok: false, error: memberError.message };
    }
  }

  return { ok: true, orgId };
}

/** @deprecated Use ensureClinicaSharedOrgMembership */
export const ensureClinicaPacienteOrgMembership = ensureClinicaSharedOrgMembership;

/** Maps panel plan codes (and legacy values) to the clinica portal role. */
export function clinicaPortalRoleFromPlan(plan: string): "medico" | "paciente" {
  const p = plan.trim().toLowerCase();

  if (
    p.includes("medico") ||
    p.includes("médico") ||
    p.includes("turnero") ||
    p.includes("institucional") ||
    p === "profesional" ||
    p === "pro"
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
  const orgId = getDefaultClinicOrgId();
  const { firstName, lastName, display } = splitName(params.clientName, email);

  if (params.portalRole === "paciente") {
    // Drop mistaken professional row (platform-sync on medico tab for patient accounts)
    const { error: delProf } = await db
      .from("professionals")
      .delete()
      .eq("user_id", params.userId);
    if (delProf?.code === "23503") {
      await db
        .from("professionals")
        .update({ user_id: null })
        .eq("user_id", params.userId);
    }

    const { data: existing, error: fetchError } = await db
      .from("patients")
      .select("id, profile_id, org_id")
      .eq("email", email)
      .maybeSingle();

    if (fetchError) {
      return { ok: false, error: fetchError.message };
    }

    if (existing) {
      const patch: Record<string, unknown> = {};
      if (!existing.profile_id) patch.profile_id = params.userId;
      if (existing.org_id !== orgId) patch.org_id = orgId;
      if (Object.keys(patch).length > 0) {
        await db.from("patients").update(patch).eq("id", existing.id);
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
    .select("id, user_id, org_id")
    .eq("email", email)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }

  if (existing) {
    const patch: Record<string, unknown> = {};
    if (!existing.user_id) patch.user_id = params.userId;
    if (existing.org_id !== orgId) patch.org_id = orgId;
    if (Object.keys(patch).length > 0) {
      await db.from("professionals").update(patch).eq("id", existing.id);
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
    specialty: "Sin Asignar",
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

/** Removes clinica portal rows for revoke (role-aware when possible). */
export async function revokeClinicaPortalAccess(params: {
  email?: string | null;
  userId?: string | null;
  portalRole?: "medico" | "paciente" | "both";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createNodoAdminClient("clinica");
  if (!admin) {
    return { ok: false, error: "Nodo Clínica no configurado para revocar acceso." };
  }

  const db = admin.schema("nodo_clinica");
  let email = params.email?.trim().toLowerCase() ?? null;
  let userId = params.userId ?? null;
  const role = params.portalRole ?? "both";
  const removePatients = role === "both" || role === "paciente";
  const removeProfessionals = role === "both" || role === "medico";

  if (!userId && email) {
    const { data: listData } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const found = listData?.users?.find(
      (u) => String(u.email ?? "").toLowerCase() === email,
    );
    userId = found?.id ?? null;
  }

  async function softDeleteOrAnonymize(
    table: "patients" | "professionals",
    id: string,
    anonymize: Record<string, unknown>,
  ): Promise<string | null> {
    const { error } = await db.from(table).delete().eq("id", id);
    if (!error) return null;
    if (error.code === "23503") {
      await db.from(table).update(anonymize).eq("id", id);
      return null;
    }
    return error.message;
  }

  async function removePatientRows() {
    if (!removePatients) return null;
    const ids = new Set<string>();

    if (userId) {
      const { data } = await db
        .from("patients")
        .select("id")
        .eq("profile_id", userId);
      for (const row of data ?? []) ids.add(row.id);
    }
    if (email) {
      const { data } = await db
        .from("patients")
        .select("id")
        .ilike("email", email);
      for (const row of data ?? []) ids.add(row.id);
    }

    for (const id of ids) {
      const err = await softDeleteOrAnonymize("patients", id, {
        profile_id: null,
        email: `revoked+${id.slice(0, 8)}@deleted.local`,
      });
      if (err) return err;
    }
    return null;
  }

  async function removeProfessionalRows() {
    if (!removeProfessionals) return null;
    const ids = new Set<string>();

    if (userId) {
      const { data } = await db
        .from("professionals")
        .select("id")
        .eq("user_id", userId);
      for (const row of data ?? []) ids.add(row.id);
    }
    if (email) {
      const { data } = await db
        .from("professionals")
        .select("id")
        .ilike("email", email);
      for (const row of data ?? []) ids.add(row.id);
    }

    for (const id of ids) {
      const err = await softDeleteOrAnonymize("professionals", id, {
        user_id: null,
        email: `revoked+${id.slice(0, 8)}@deleted.local`,
      });
      if (err) return err;
    }

    if (userId && removeProfessionals && admin) {
      await admin
        .schema("shared")
        .from("org_members")
        .delete()
        .eq("user_id", userId)
        .eq("org_id", getDefaultClinicOrgId());
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
