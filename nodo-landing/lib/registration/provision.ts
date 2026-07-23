import type { SupabaseClient } from "@supabase/supabase-js";
import { getNodeDefaultTheme, isEmptyThemeSettings } from "@nodocore/shared-components/lib/node-default-theme";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNodoAdminClient, getLandingAuthConfig } from "@/lib/supabase/nodo-admin";
import { syncNodeEmailAccessForClient } from "@/lib/registration/client-unit-auth";
import {
  finanzasThemeAppMetadata,
  seedInmoOrgProfileTheme,
} from "@/lib/registration/seed-node-theme";
import {
  clinicaPortalRoleFromPlan,
  ensureClinicaPacienteOrgMembership,
  ensureClinicaPortalProfile,
} from "@/lib/registration/clinica-provision";
import { findAuthUserByEmail, authConfigForNodoCode } from "@/lib/registration/auth-user-lookup";

function planToTier(plan: string): "starter" | "pro" {
  return plan.toLowerCase().includes("pro") ? "pro" : "starter";
}

function autosIdentificador(email: string, userId: string): string {
  const base = email.split("@")[0].replace(/\W/g, "_").slice(0, 32);
  const suffix = userId.replace(/-/g, "").slice(0, 8);
  return `${base}_${suffix}`.slice(0, 40);
}

async function ensureAutosAccess(
  admin: SupabaseClient,
  params: {
    userId: string;
    email: string;
    clientName: string;
    password: string;
    plan: string;
  },
): Promise<{ clienteId: string } | { error: string }> {
  const { userId, email, clientName, password, plan } = params;
  const tier = planToTier(plan);
  const defaultTheme = getNodeDefaultTheme("Autos");

  const { data: clienteId, error: rpcErr } = await admin.rpc(
    "admin_ensure_autos_access",
    {
      p_user_id: userId,
      p_email: email,
      p_client_name: clientName,
      p_identificador: autosIdentificador(email, userId),
      p_default_theme: defaultTheme,
    },
  );

  if (rpcErr) {
    return { error: "Error al provisionar autos: " + rpcErr.message };
  }

  if (!clienteId) {
    return { error: "No se pudo resolver la concesionaria autos." };
  }

  // Ensure shared org membership so NodoSwitcher can see this nodo.
  const { data: orgId, error: membershipErr } = await admin.rpc(
    "admin_ensure_inmo_membership",
    {
      p_user_id: userId,
      p_client_name: clientName || email,
      p_email: email,
      p_plan: plan,
      p_product: "autos",
    },
  );

  if (membershipErr) {
    return { error: "Error al crear membresía autos: " + membershipErr.message };
  }

  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    password,
    ban_duration: "none",
    app_metadata: {
      role: "administrador",
      cliente_id: clienteId,
      plan: tier,
      org_id: orgId,
    },
  });

  if (authErr) {
    return { error: "Error al actualizar credenciales autos: " + authErr.message };
  }

  return { clienteId: clienteId as string };
}

async function ensureInmoMembership(
  admin: SupabaseClient,
  params: {
    userId: string;
    email: string;
    clientName: string;
    plan: string;
    product: "inmo" | "clinica";
  },
): Promise<{ orgId: string } | { error: string }> {
  const { userId, email, clientName, plan, product } = params;

  const { data: orgId, error: rpcErr } = await admin.rpc("admin_ensure_inmo_membership", {
    p_user_id: userId,
    p_client_name: clientName,
    p_email: email,
    p_plan: plan,
    p_product: product,
  });

  if (rpcErr) {
    return { error: "Error al asegurar membresía: " + rpcErr.message };
  }

  if (!orgId) {
    return { error: "No se pudo resolver la organización." };
  }

  return { orgId: orgId as string };
}

async function ensureInmoAccess(
  admin: SupabaseClient,
  params: {
    userId: string;
    email: string;
    clientName: string;
    password: string;
    plan: string;
    product: "inmo" | "clinica";
  },
): Promise<{ orgId: string } | { error: string }> {
  const { userId, password, plan, product } = params;
  const tier = planToTier(plan);

  const portalRole =
    product === "clinica" ? clinicaPortalRoleFromPlan(plan) : null;

  let membership: { orgId: string } | { error: string };
  if (product === "clinica" && portalRole === "paciente") {
    const shared = await ensureClinicaPacienteOrgMembership(admin, {
      userId,
      clientName: params.clientName,
      email: params.email,
    });
    if (!shared.ok) return { error: shared.error };
    membership = { orgId: shared.orgId };
  } else {
    membership = await ensureInmoMembership(admin, params);
  }
  if ("error" in membership) return membership;

  const [{ data: userData }, memberRowResult] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    portalRole === "paciente"
      ? Promise.resolve({ data: null })
      : admin
          .schema("shared")
          .from("org_members")
          .select("role")
          .eq("org_id", membership.orgId)
          .eq("user_id", userId)
          .maybeSingle(),
  ]);

  const currentAppMetadata = userData.user?.app_metadata ?? {};
  const memberRow = memberRowResult.data;
  const orgRole = (memberRow?.role as string | undefined) ?? "super_admin";
  const jwtRole = portalRole ?? orgRole;

  const updatePayload: {
    password?: string;
    ban_duration: string;
    app_metadata: Record<string, unknown>;
  } = {
    ban_duration: "none",
    app_metadata: {
      ...currentAppMetadata,
      org_id: membership.orgId,
      role: jwtRole,
      plan: tier,
      subscription_plan: plan,
      must_set_password: false,
    },
  };

  if (password) {
    updatePayload.password = password;
  }

  const { error: authErr } = await admin.auth.admin.updateUserById(userId, updatePayload);

  if (authErr) {
    return { error: "Error al actualizar credenciales: " + authErr.message };
  }

  const postUpdateTasks: Promise<{ ok: true } | { ok: false; error: string } | void>[] = [];

  if (!(product === "clinica" && portalRole === "paciente")) {
    postUpdateTasks.push(
      seedInmoOrgProfileTheme(admin, membership.orgId, params.clientName, product),
    );
  }

  if (product === "clinica" && portalRole) {
    postUpdateTasks.unshift(
      ensureClinicaPortalProfile({
        userId,
        email: params.email,
        clientName: params.clientName,
        orgId: membership.orgId,
        plan,
        portalRole,
      }),
    );
  }

  const postResults = await Promise.all(postUpdateTasks);
  for (const result of postResults) {
    if (result && "ok" in result && !result.ok) {
      return { error: result.error };
    }
  }

  return { orgId: membership.orgId };
}

/** Re-sync org membership + JWT claims for dashboard-managed Inmo users. */
export async function syncInmoUserClaims(params: {
  nodoCode: string;
  userId: string;
  email: string;
  clientName: string;
  password?: string;
  plan: string;
}): Promise<{ ok: true; org_id: string } | { ok: false; error: string }> {
  const code = params.nodoCode.toLowerCase();
  if (!["inmo", "clínica", "clinica", "salud"].includes(code)) {
    return { ok: false, error: `El nodo "${params.nodoCode}" no usa claims de Inmo.` };
  }

  const admin = createNodoAdminClient(params.nodoCode);
  if (!admin) {
    return { ok: false, error: `Nodo "${params.nodoCode}" no configurado.` };
  }

  const product = code === "inmo" ? "inmo" : "clinica";
  const result = await ensureInmoAccess(admin, {
    userId: params.userId,
    email: params.email,
    clientName: params.clientName,
    password: params.password ?? "",
    plan: params.plan,
    product,
  });

  if ("error" in result) {
    return { ok: false, error: result.error };
  }

  return { ok: true, org_id: result.orgId };
}

export type ProvisionResult = {
  ok: boolean;
  user_id?: string;
  org_id?: string;
  cliente_id?: string;
  existing?: boolean;
  error?: string;
};

/** Provision admin user + tenant in the target nodo's Supabase project. */
export async function provisionNodoAccess(params: {
  nodoCode: string;
  clientName: string;
  email: string;
  password: string;
  plan: string;
}): Promise<ProvisionResult> {
  const { nodoCode, clientName, email, password, plan } = params;
  const code = nodoCode.toLowerCase();

  const admin = createNodoAdminClient(nodoCode);
  if (!admin) {
    return { ok: false, error: `Nodo "${nodoCode}" no configurado para provisionamiento.` };
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: clientName || email },
    app_metadata: { plan: planToTier(plan) },
  });

  let userId: string | undefined;

  if (createErr) {
    const msg = createErr.message ?? "";
    if (msg.toLowerCase().includes("already")) {
      const authConfig = authConfigForNodoCode(nodoCode);
      const found = authConfig ? await findAuthUserByEmail(authConfig, email, admin) : null;
      if (!found) return { ok: false, error: msg };
      userId = found.userId;

      if (code === "finanzas") {
        const currentMeta = found.appMetadata ?? {};
        const themePatch = isEmptyThemeSettings(currentMeta.theme_settings)
          ? finanzasThemeAppMetadata()
          : {};
        await admin.auth.admin.updateUserById(userId, {
          password,
          app_metadata: {
            ...currentMeta,
            role: "user",
            plan: planToTier(plan),
            ...themePatch,
          },
        });
        return { ok: true, existing: true, user_id: userId };
      }

      if (code === "autos") {
        const autosResult = await ensureAutosAccess(admin, {
          userId,
          email,
          clientName,
          password,
          plan,
        });
        if ("error" in autosResult) {
          return { ok: false, error: autosResult.error };
        }
        return {
          ok: true,
          existing: true,
          user_id: userId,
          cliente_id: autosResult.clienteId,
        };
      }

      if (code === "inmo" || code === "clínica" || code === "clinica" || code === "salud") {
        const product = code === "inmo" ? "inmo" : "clinica";
        const inmoResult = await ensureInmoAccess(admin, {
          userId,
          email,
          clientName,
          password,
          plan,
          product,
        });
        if ("error" in inmoResult) {
          return { ok: false, error: inmoResult.error };
        }
        return {
          ok: true,
          existing: true,
          user_id: userId,
          org_id: inmoResult.orgId,
        };
      }

      await admin.auth.admin.updateUserById(userId, { password, ban_duration: "none" });
      return { ok: true, existing: true, user_id: userId };
    }
    return { ok: false, error: msg };
  }

  userId = created.user!.id;

  if (code === "inmo" || code === "clínica" || code === "clinica" || code === "salud") {
    const product = code === "inmo" ? "inmo" : "clinica";

    const claims = await ensureInmoAccess(admin, {
      userId,
      email,
      clientName,
      password,
      plan,
      product,
    });

    if ("error" in claims) {
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: claims.error };
    }

    return { ok: true, user_id: userId, org_id: claims.orgId };
  }

  if (code === "autos") {
    const autosResult = await ensureAutosAccess(admin, {
      userId,
      email,
      clientName,
      password,
      plan,
    });

    if ("error" in autosResult) {
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: autosResult.error };
    }

    return { ok: true, user_id: userId, cliente_id: autosResult.clienteId };
  }

  if (code === "finanzas") {
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        role: "user",
        plan: planToTier(plan),
        ...finanzasThemeAppMetadata(),
      },
    });
    return { ok: true, user_id: userId };
  }

  return { ok: true, user_id: userId };
}

function tempPassword(): string {
  return `${crypto.randomUUID()}Aa1!`;
}

/** Provision tenant + auth user; password set later on first login. */
export async function provisionNodoAccessPendingPassword(params: {
  nodoCode: string;
  clientName: string;
  email: string;
  plan: string;
}): Promise<ProvisionResult> {
  const result = await provisionNodoAccess({
    ...params,
    password: tempPassword(),
  });

  if (!result.ok || !result.user_id) return result;

  const admin = createNodoAdminClient(params.nodoCode);
  if (admin) {
    await admin.auth.admin.updateUserById(result.user_id, {
      app_metadata: { must_set_password: true, plan: planToTier(params.plan) },
      ban_duration: "none",
    });
  }

  return result;
}

export async function updateNodoUserPassword(
  nodoCode: string,
  userId: string,
  password: string,
): Promise<boolean> {
  const admin = createNodoAdminClient(nodoCode);
  if (!admin) return false;

  const { data } = await admin.auth.admin.getUserById(userId);
  const currentAppMetadata = data.user?.app_metadata ?? {};

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    app_metadata: { ...currentAppMetadata, must_set_password: false },
  });
  return !error;
}

/** Auth user without usable password — first login sets credentials. */
export async function createLandingAuthPendingPassword(
  admin: SupabaseClient<any, "public", any>,
  email: string,
  fullName: string,
  role: string,
): Promise<string | null> {
  const password = tempPassword();
  const { data: newUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role, must_set_password: true },
  });

  if (!authErr && newUser?.user) return newUser.user.id;

  if (authErr?.message?.toLowerCase().includes("already")) {
    const authConfig = getLandingAuthConfig();
    const matched = authConfig ? await findAuthUserByEmail(authConfig, email, admin) : null;
    if (matched) {
      await admin.auth.admin.updateUserById(matched.userId, {
        app_metadata: { role, must_set_password: true },
        user_metadata: { full_name: fullName },
      });
      return matched.userId;
    }
  }

  console.error("createLandingAuthPendingPassword failed:", authErr);
  return null;
}

/** Create or update landing auth user with a known password. */
export async function ensureLandingAuthUser(
  admin: SupabaseClient<any, "public", any>,
  email: string,
  password: string,
  fullName: string,
  role: string,
): Promise<string | null> {
  const { data: newUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role },
  });

  if (!authErr && newUser?.user) return newUser.user.id;

  if (authErr?.message?.toLowerCase().includes("already")) {
    const authConfig = getLandingAuthConfig();
    const matched = authConfig ? await findAuthUserByEmail(authConfig, email, admin) : null;
    if (matched) {
      await admin.auth.admin.updateUserById(matched.userId, {
        password,
        app_metadata: { role },
        user_metadata: { full_name: fullName },
      });
      return matched.userId;
    }
  }

  console.error("ensureLandingAuthUser failed:", authErr);
  return null;
}
