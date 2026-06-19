import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import { NODES } from "@/lib/nodes";
import { provisionNodoAccess, syncInmoUserClaims } from "@/lib/registration/provision";

export const MIN_ACCESS_PASSWORD_LENGTH = 8;

export function generateTemporaryPassword(): string {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `Nodo-${token}Aa1!`;
}

/** Keeps node_email_access aligned with dashboard client_units (required for login guard). */
export async function syncNodeEmailAccessForClient(
  admin: SupabaseClient<any, "public", string, any, any>,
  clientId: string,
): Promise<void> {
  const { data: units, error } = await admin
    .from("client_units")
    .select("id, unit_code, status, access_user")
    .eq("client_id", clientId);

  if (error || !units?.length) return;

  for (const unit of units) {
    const email = unit.access_user?.trim().toLowerCase();
    if (!email) continue;

    const accessRow = {
      email,
      unit_code: unit.unit_code,
      client_id: clientId,
      client_unit_id: unit.id,
      status: unit.status,
    };

    const { data: existing } = await admin
      .from("node_email_access")
      .select("id")
      .eq("email", email)
      .eq("unit_code", unit.unit_code)
      .maybeSingle();

    if (existing) {
      await admin.from("node_email_access").update(accessRow).eq("id", existing.id);
    } else {
      await admin.from("node_email_access").insert(accessRow);
    }
  }
}

export function authAdminForUnitCode(unitCode: string) {
  return createNodoAdminClient(unitCode) ?? createAdminClient();
}

function defaultAuthRoleForUnit(unitCode: string): string {
  const code = unitCode.toLowerCase();
  if (code === "finanzas") return "user";
  if (code === "autos") return "administrador";
  if (code === "clínica" || code === "clinica" || code === "salud") return "paciente";
  if (code === "inmo") return "admin";
  return "user";
}

/** Creates or updates the Auth user for a client unit (any nodo with access email). */
export async function ensureAuthUserForUnit(
  authAdmin: SupabaseClient<any, any, any>,
  params: {
    unit: {
      access_user: string | null;
      provision_user_id: string | null;
    };
    password: string;
    mustSetPassword: boolean;
    unitCode: string;
    clientName?: string;
    plan?: string;
  },
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const existing = await resolveAuthUserForUnit(authAdmin, params.unit);
  if (existing) {
    const inmoCode = params.unitCode.toLowerCase();
    const email = params.unit.access_user?.trim();

    if (
      email &&
      ["inmo", "clínica", "clinica", "salud"].includes(inmoCode)
    ) {
      const synced = await syncInmoUserClaims({
        nodoCode: params.unitCode,
        userId: existing.userId,
        email,
        clientName: params.clientName ?? email,
        password: params.password,
        plan: params.plan ?? "starter",
      });
      if (!synced.ok) return synced;
      return { ok: true, userId: existing.userId };
    }

    const updated = await setAuthUserPassword(authAdmin, existing.userId, params.password, {
      mustSetPassword: params.mustSetPassword,
      currentAppMetadata: existing.appMetadata,
    });
    if (!updated.ok) return updated;
    return { ok: true, userId: existing.userId };
  }

  const email = params.unit.access_user?.trim();
  if (!email) {
    return { ok: false, error: "Sin email de acceso." };
  }

  const nodeDef = NODES.find((node) => node.code === params.unitCode);
  if (nodeDef?.provisionable) {
    const result = await provisionNodoAccess({
      nodoCode: params.unitCode,
      clientName: params.clientName ?? email,
      email,
      password: params.password,
      plan: params.plan ?? "starter",
    });
    if (!result.ok || !result.user_id) {
      return { ok: false, error: result.error ?? "No se pudo crear el acceso." };
    }
    if (params.mustSetPassword) {
      const { data } = await authAdmin.auth.admin.getUserById(result.user_id);
      await setAuthUserPassword(authAdmin, result.user_id, params.password, {
        mustSetPassword: true,
        currentAppMetadata: data.user?.app_metadata ?? {},
      });
    }
    return { ok: true, userId: result.user_id };
  }

  const role = defaultAuthRoleForUnit(params.unitCode);
  const { data: created, error: createErr } = await authAdmin.auth.admin.createUser({
    email,
    password: params.password,
    email_confirm: true,
    user_metadata: { full_name: params.clientName ?? email },
    app_metadata: { role, must_set_password: params.mustSetPassword },
  });

  if (!createErr && created?.user) {
    return { ok: true, userId: created.user.id };
  }

  if (createErr?.message?.toLowerCase().includes("already")) {
    const resolved = await resolveAuthUserForUnit(authAdmin, { access_user: email, provision_user_id: null });
    if (resolved) {
      const updated = await setAuthUserPassword(authAdmin, resolved.userId, params.password, {
        mustSetPassword: params.mustSetPassword,
        currentAppMetadata: resolved.appMetadata,
      });
      if (!updated.ok) return updated;
      return { ok: true, userId: resolved.userId };
    }
  }

  return { ok: false, error: createErr?.message ?? "No se pudo crear el usuario de acceso." };
}

export async function resolveAuthUserForUnit(
  authAdmin: SupabaseClient<any, any, any>,
  unit: {
    access_user: string | null;
    provision_user_id: string | null;
  },
): Promise<{ userId: string; appMetadata: Record<string, unknown> } | null> {
  if (unit.provision_user_id) {
    const { data } = await authAdmin.auth.admin.getUserById(unit.provision_user_id);
    if (data.user) {
      return {
        userId: data.user.id,
        appMetadata: data.user.app_metadata ?? {},
      };
    }
  }

  if (!unit.access_user) return null;

  const { data } = await authAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const matched = data.users.find(
    (user) => user.email?.toLowerCase() === unit.access_user!.toLowerCase(),
  );
  if (!matched) return null;

  return {
    userId: matched.id,
    appMetadata: matched.app_metadata ?? {},
  };
}

export async function setAuthUserPassword(
  authAdmin: SupabaseClient<any, any, any>,
  userId: string,
  password: string,
  options: {
    mustSetPassword: boolean;
    currentAppMetadata?: Record<string, unknown>;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const appMetadata = {
    ...(options.currentAppMetadata ?? {}),
    must_set_password: options.mustSetPassword,
  };

  const { error } = await authAdmin.auth.admin.updateUserById(userId, {
    password,
    app_metadata: appMetadata,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
