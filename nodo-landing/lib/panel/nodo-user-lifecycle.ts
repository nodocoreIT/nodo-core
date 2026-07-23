import { createAdminClient } from "@/lib/supabase/admin";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import { authAdminForUnitCode, resolveAuthUserForUnit } from "@/lib/registration/client-unit-auth";
import { setNodoAuthSuspended } from "@/lib/registration/nodo-access-suspend";
import { syncNodeEmailAccessForClient } from "@/lib/registration/client-unit-auth";
import { getNodeMailLabelByCode } from "@/lib/nodes";
import {
  revokeClinicaPortalAccess,
  softRevokeClinicaPortalAccess,
  isClinicaUnitCode,
  getDefaultClinicOrgId,
} from "@/lib/registration/clinica-provision";
import type { NodoUserRecord } from "@/lib/panel/nodo-users-list";

export type ImpactSeverity = "info" | "warning" | "destructive";

export type ImpactLine = {
  id: string;
  label: string;
  detail?: string;
  count?: number;
  severity: ImpactSeverity;
};

export type UserActionPreview = {
  action: "delete" | "revoke";
  email: string;
  unitCode: string;
  unitLabel: string;
  summary: string;
  lines: ImpactLine[];
  willDeleteAuthUser: boolean;
  authUserId: string | null;
  warnings: string[];
};

function normalizeCode(unitCode: string): string {
  return unitCode.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function nodoAdminCode(unitCode: string): string {
  const code = normalizeCode(unitCode);
  if (code === "clinica" || code === "salud") return "clinica";
  if (code === "inmo") return "inmo";
  if (code === "autos") return "autos";
  if (code === "ecommerce") return "ecommerce";
  if (code === "finanzas") return "finanzas";
  return code;
}

async function resolveAuthUserId(user: NodoUserRecord): Promise<string | null> {
  if (user.authUserId) return user.authUserId;

  const authAdmin = authAdminForUnitCode(user.unitCode);
  if (!authAdmin || !user.email) return null;

  const resolved = await resolveAuthUserForUnit(
    authAdmin,
    { access_user: user.email, provision_user_id: null },
    user.unitCode,
  );
  return resolved?.userId ?? null;
}

async function countRows(
  client: ReturnType<typeof createNodoAdminClient>,
  schema: string,
  table: string,
  column: string,
  value: string,
): Promise<number> {
  if (!client) return 0;
  const { count, error } = await client
    .schema(schema)
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) return 0;
  return count ?? 0;
}

async function countOtherOrgMemberships(
  authAdmin: ReturnType<typeof createNodoAdminClient>,
  userId: string,
  excludeOrgId?: string | null,
): Promise<number> {
  if (!authAdmin) return 0;
  let query = authAdmin.schema("shared").from("org_members").select("*", { count: "exact", head: true }).eq("user_id", userId);
  if (excludeOrgId) query = query.neq("org_id", excludeOrgId);
  const { count } = await query;
  return count ?? 0;
}

async function countOtherClientUnits(email: string, excludeUnitId?: string | null): Promise<number> {
  const admin = createAdminClient();
  let query = admin
    .from("client_units")
    .select("*", { count: "exact", head: true })
    .ilike("access_user", email);
  if (excludeUnitId) query = query.neq("id", excludeUnitId);
  const { count } = await query;
  return count ?? 0;
}

async function buildFinanzasImpact(authUserId: string): Promise<ImpactLine[]> {
  const admin = createNodoAdminClient("finanzas");
  if (!admin) return [];

  const tables = [
    "movimientos_cuenta",
    "gastos_diarios",
    "gastos_fijos",
    "cuentas",
    "cuentas_bancarias",
    "tarjetas",
    "tarjetas_consumos",
    "prestamos",
    "planes_ahorro",
    "categorias",
    "rubros",
    "configuracion_usuario",
  ];

  const lines: ImpactLine[] = [];
  for (const table of tables) {
    const count = await countRows(admin, "nodo_finanzas_personales", table, "user_id", authUserId);
    if (count > 0) {
      lines.push({
        id: `finanzas.${table}`,
        label: `Finanzas · ${table.replace(/_/g, " ")}`,
        count,
        severity: "destructive",
        detail: "Se eliminarán filas de forma explícita (sin depender de cascadas de Auth).",
      });
    }
  }
  return lines;
}

async function buildClinicaPatientImpact(patientId: string): Promise<ImpactLine[]> {
  const db = createAdminClient("nodo_clinica");
  const lines: ImpactLine[] = [];

  const tables: Array<{ table: string; column: string }> = [
    { table: "appointments", column: "patient_id" },
    { table: "clinical_records", column: "patient_id" },
    { table: "patient_documents", column: "patient_id" },
    { table: "patient_health_profiles", column: "patient_id" },
  ];

  for (const { table, column } of tables) {
    const { count } = await db.from(table).select("*", { count: "exact", head: true }).eq(column, patientId);
    if ((count ?? 0) > 0) {
      lines.push({
        id: `clinica.${table}`,
        label: `Clínica · ${table.replace(/_/g, " ")}`,
        count: count ?? 0,
        severity: "destructive",
      });
    }
  }

  lines.push({
    id: "clinica.patients",
    label: "Clínica · perfil de paciente",
    count: 1,
    severity: "destructive",
  });

  return lines;
}

async function buildClinicaMedicoImpact(professionalId: string, authUserId: string | null): Promise<ImpactLine[]> {
  const db = createAdminClient("nodo_clinica");
  const lines: ImpactLine[] = [];

  const tables: Array<{ table: string; column: string; value: string }> = [
    { table: "appointments", column: "doctor_id", value: professionalId },
    { table: "office_settings", column: "professional_id", value: professionalId },
    { table: "doctor_tasks", column: "professional_id", value: professionalId },
  ];

  for (const { table, column, value } of tables) {
    const { count } = await db.from(table).select("*", { count: "exact", head: true }).eq(column, value);
    if ((count ?? 0) > 0) {
      lines.push({
        id: `clinica.${table}`,
        label: `Clínica · ${table.replace(/_/g, " ")}`,
        count: count ?? 0,
        severity: "destructive",
      });
    }
  }

  lines.push({
    id: "clinica.professionals",
    label: "Clínica · perfil de médico",
    count: 1,
    severity: "destructive",
  });

  if (authUserId) {
    lines.push({
      id: "shared.org_members",
      label: "Membresía en organización clínica (shared.org_members)",
      count: 1,
      severity: "warning",
      detail: "Solo se quita la membresía del usuario; la organización y datos de otros miembros no se tocan.",
    });
  }

  return lines;
}

export async function previewNodoUserAction(
  user: NodoUserRecord,
  action: "delete" | "revoke",
): Promise<UserActionPreview> {
  const unitLabel = user.unitLabel || getNodeMailLabelByCode(user.unitCode);
  const authUserId = await resolveAuthUserId(user);
  const lines: ImpactLine[] = [];
  const warnings: string[] = [];

  if (action === "revoke") {
    lines.push({
      id: "access.revoke",
      label: "Acceso al nodo",
      severity: "warning",
      detail: "Se suspenderá el login y se quitarán credenciales de acceso. Los datos operativos se conservan.",
    });
    if (user.clientUnitId) {
      lines.push({
        id: "landing.node_email_access",
        label: "Registro de acceso por email (node_email_access)",
        count: 1,
        severity: "warning",
      });
    }
    return {
      action,
      email: user.email,
      unitCode: user.unitCode,
      unitLabel,
      summary: "Revocación de acceso (sin borrar datos operativos del nodo).",
      lines,
      willDeleteAuthUser: false,
      authUserId,
      warnings,
    };
  }

  // DELETE preview
  if (user.clientUnitId) {
    lines.push({
      id: "landing.client_units",
      label: "Unidad contratada (credenciales y vínculo de acceso)",
      count: 1,
      severity: "destructive",
    });
    lines.push({
      id: "landing.node_email_access",
      label: "Acceso por email en Nodo Core",
      count: 1,
      severity: "destructive",
    });
  }

  if (user.id.startsWith("clinic-patient:")) {
    const patientId = user.id.replace("clinic-patient:", "");
    lines.push(...(await buildClinicaPatientImpact(patientId)));
  } else if (user.id.startsWith("clinic-medico:")) {
    const professionalId = user.id.replace("clinic-medico:", "");
    lines.push(...(await buildClinicaMedicoImpact(professionalId, authUserId)));
  } else if (user.id.startsWith("member:")) {
    lines.push({
      id: "shared.org_members",
      label: `Membresía en ${user.orgName ?? "organización"} (${user.role ?? "miembro"})`,
      count: 1,
      severity: "destructive",
      detail: "Solo esta membresía. No se borran propiedades, turnos ni datos del resto del equipo.",
    });
    if (authUserId) {
      const other = await countOtherOrgMemberships(
        createNodoAdminClient(nodoAdminCode(user.unitCode)),
        authUserId,
        user.orgId,
      );
      if (other > 0) {
        warnings.push(`El usuario tiene ${other} membresía(s) en otras organizaciones. No se eliminará la cuenta Auth.`);
      }
    }
  }

  const code = normalizeCode(user.unitCode);
  if (authUserId && code === "finanzas") {
    lines.push(...(await buildFinanzasImpact(authUserId)));
    warnings.push(
      "En Finanzas se borran cuentas, movimientos, tarjetas y toda la configuración personal del usuario de forma explícita.",
    );
  }

  if (authUserId && code === "inmo" && user.accessType === "suscripcion") {
    warnings.push(
      "Este usuario es administrador de una inmobiliaria. NO se borrarán propiedades, contratos ni caja de la organización — solo su acceso.",
    );
  }

  if (authUserId && isClinicaUnitCode(user.unitCode)) {
    lines.push({
      id: "landing.pending_clinic_registrations",
      label: "Solicitudes de registro pendientes (email)",
      severity: "destructive",
    });
  }

  const otherUnits = user.clientUnitId
    ? await countOtherClientUnits(user.email, user.clientUnitId)
    : await countOtherClientUnits(user.email);
  const otherMemberships = authUserId
    ? await countOtherOrgMemberships(createNodoAdminClient(nodoAdminCode(user.unitCode)), authUserId, user.orgId)
    : 0;

  const willDeleteAuthUser = Boolean(
    authUserId && otherUnits === 0 && otherMemberships === 0,
  );

  if (authUserId && willDeleteAuthUser) {
    lines.push({
      id: "auth.users",
      label: "Cuenta Auth (auth.users)",
      count: 1,
      severity: "destructive",
      detail: "Se elimina al final, después de limpiar tablas de negocio de forma controlada.",
    });
  } else if (authUserId) {
    warnings.push("La cuenta Auth se conserva porque el usuario tiene acceso en otro nodo u organización.");
  }

  return {
    action: "delete",
    email: user.email,
    unitCode: user.unitCode,
    unitLabel,
    summary: "Eliminación completa del usuario en este nodo (sin cascadas sorpresa).",
    lines,
    willDeleteAuthUser,
    authUserId,
    warnings,
  };
}

async function deleteClinicaPatientExplicit(patientId: string, email: string, authUserId: string | null) {
  const db = createAdminClient("nodo_clinica");

  const { data: appointments } = await db.from("appointments").select("id").eq("patient_id", patientId);
  const appointmentIds = (appointments ?? []).map((a) => a.id as string);

  if (appointmentIds.length > 0) {
    await db.from("clinical_notes").delete().in("appointment_id", appointmentIds);
    await db.from("soap_summaries").delete().in("appointment_id", appointmentIds);
    await db.from("transcriptions").delete().in("appointment_id", appointmentIds);
    await db.from("appointments").delete().in("id", appointmentIds);
  }

  await db.from("clinical_records").delete().eq("patient_id", patientId);
  await db.from("patient_documents").delete().eq("patient_id", patientId);
  await db.from("patient_health_profiles").delete().eq("patient_id", patientId);
  await db.from("patients").delete().eq("id", patientId);

  await db.from("pending_clinic_registrations").delete().ilike("email", email);
}

async function deleteClinicaMedicoExplicit(professionalId: string, email: string, authUserId: string | null) {
  const db = createAdminClient("nodo_clinica");
  const nodoAdmin = createNodoAdminClient("clinica");

  await db.from("doctor_tasks").delete().eq("professional_id", professionalId);
  await db.from("office_settings").delete().eq("professional_id", professionalId);
  await db.from("appointments").delete().eq("doctor_id", professionalId);
  await db.from("professionals").delete().eq("id", professionalId);
  await db.from("pending_clinic_registrations").delete().ilike("email", email);

  if (authUserId && nodoAdmin) {
    await nodoAdmin
      .schema("shared")
      .from("org_members")
      .delete()
      .eq("user_id", authUserId)
      .eq("org_id", getDefaultClinicOrgId());
    await nodoAdmin.schema("shared").from("user_profiles").delete().eq("id", authUserId);
  }
}

export async function deleteNodoUser(user: NodoUserRecord): Promise<{ ok: true } | { ok: false; error: string }> {
  const landingAdmin = createAdminClient();
  const authUserId = await resolveAuthUserId(user);
  const email = user.email.trim().toLowerCase();
  const nodoCode = nodoAdminCode(user.unitCode);
  const authAdmin = authAdminForUnitCode(user.unitCode);

  try {
    const preview = await previewNodoUserAction(user, "delete");

    if (user.clientUnitId) {
      const { data: unit } = await landingAdmin
        .from("client_units")
        .select("id, unit_code, client_id, provision_user_id, access_user, plan")
        .eq("id", user.clientUnitId)
        .maybeSingle();

      if (unit) {
        const code = normalizeCode(unit.unit_code);
        if (code === "finanzas") {
          const finUserId = unit.provision_user_id ?? authUserId;
          if (finUserId) {
            const finAdmin = createNodoAdminClient("finanzas");
            if (finAdmin) {
              await finAdmin.schema("nodo_finanzas_personales").rpc("purge_user_data", {
                p_user_id: finUserId,
              });
            }
          }
        }

        await landingAdmin.from("node_email_access").delete().eq("client_unit_id", unit.id);
        await landingAdmin
          .from("client_units")
          .update({
            access_user: null,
            access_password: null,
            provision_user_id: null,
            provisioned_at: null,
            status: "pausado",
          })
          .eq("id", unit.id);

        if (unit.client_id) await syncNodeEmailAccessForClient(landingAdmin, unit.client_id);
      }
    }

    if (user.id.startsWith("clinic-patient:")) {
      await deleteClinicaPatientExplicit(user.id.replace("clinic-patient:", ""), email, authUserId);
    } else if (user.id.startsWith("clinic-medico:")) {
      await deleteClinicaMedicoExplicit(user.id.replace("clinic-medico:", ""), email, authUserId);
    } else if (user.id.startsWith("member:") && authUserId && user.orgId && authAdmin) {
      await authAdmin
        .schema("shared")
        .from("org_members")
        .delete()
        .eq("user_id", authUserId)
        .eq("org_id", user.orgId);
    }

    if (isClinicaUnitCode(user.unitCode) && !user.id.startsWith("clinic-")) {
      await revokeClinicaPortalAccess({
        email,
        userId: authUserId,
        portalRole: user.role === "medico" ? "medico" : user.role === "paciente" ? "paciente" : "both",
      });
    }

    await landingAdmin.from("node_email_access").delete().eq("email", email).eq("unit_code", user.unitCode);

    const clinicDb = createAdminClient("nodo_clinica");
    await clinicDb.from("pending_clinic_registrations").delete().ilike("email", email);

    if (preview.willDeleteAuthUser && authUserId && authAdmin) {
      await authAdmin.auth.admin.deleteUser(authUserId);
    } else if (authUserId && authAdmin) {
      await setNodoAuthSuspended(user.unitCode, authUserId, "suspend");
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al eliminar usuario." };
  }
}

export async function revokeNodoUser(user: NodoUserRecord): Promise<{ ok: true } | { ok: false; error: string }> {
  const landingAdmin = createAdminClient();
  const authUserId = await resolveAuthUserId(user);
  const email = user.email.trim().toLowerCase();

  try {
    if (user.clientUnitId) {
      const { data: unit } = await landingAdmin
        .from("client_units")
        .select("id, unit_code, client_id, provision_user_id, access_user, plan")
        .eq("id", user.clientUnitId)
        .maybeSingle();

      if (unit) {
        if (authUserId || unit.provision_user_id) {
          await setNodoAuthSuspended(unit.unit_code, authUserId ?? unit.provision_user_id!, "suspend");
        }
        await landingAdmin.from("client_units").update({ status: "pausado" }).eq("id", unit.id);
        if (unit.client_id) await syncNodeEmailAccessForClient(landingAdmin, unit.client_id);
      }
    }

    if (isClinicaUnitCode(user.unitCode)) {
      await softRevokeClinicaPortalAccess({
        email,
        userId: authUserId,
        portalRole: user.role === "medico" ? "medico" : user.role === "paciente" ? "paciente" : "both",
      });
    }

    if (authUserId) {
      await setNodoAuthSuspended(user.unitCode, authUserId, "suspend");
    }

    await landingAdmin.from("node_email_access").delete().eq("email", email).eq("unit_code", user.unitCode);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al revocar acceso." };
  }
}
