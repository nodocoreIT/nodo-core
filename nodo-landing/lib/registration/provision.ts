import type { SupabaseClient } from "@supabase/supabase-js";
import { getNodeDefaultTheme, isEmptyThemeSettings } from "@nodocore/shared-components/lib/node-default-theme";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";
import { syncNodeEmailAccessForClient } from "@/lib/registration/client-unit-auth";
import {
  finanzasThemeAppMetadata,
  seedAutosClienteTheme,
  seedInmoOrgProfileTheme,
} from "@/lib/registration/seed-node-theme";

const AUTOS_SCHEMA = "nodo_autos";

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
  const autos = admin.schema(AUTOS_SCHEMA);
  const tier = planToTier(plan);

  const { data: existingUser, error: existingUserErr } = await autos
    .from("users")
    .select("cliente_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (existingUserErr) {
    return { error: "Error al leer usuario autos: " + existingUserErr.message };
  }

  let clienteId = existingUser?.cliente_id as string | undefined;

  if (!clienteId) {
    const { data: existingCliente, error: existingClienteErr } = await autos
      .from("clientes")
      .select("id")
      .eq("email_contacto", email)
      .maybeSingle();

    if (existingClienteErr) {
      return { error: "Error al leer concesionaria autos: " + existingClienteErr.message };
    }

    clienteId = existingCliente?.id;

    if (!clienteId) {
      const { data: cliente, error: clienteErr } = await autos
        .from("clientes")
        .insert({
          nombre: clientName || email,
          identificador: autosIdentificador(email, userId),
          telefono: "pendiente",
          whatsapp_numero: "pendiente",
          email_contacto: email,
          theme_settings: getNodeDefaultTheme("Autos"),
        })
        .select("id")
        .single();

      if (clienteErr || !cliente) {
        return {
          error: "Error al crear concesionaria autos: " + (clienteErr?.message ?? ""),
        };
      }

      clienteId = cliente.id;
    }

    const { error: userErr } = await autos.from("users").upsert(
      {
        id: userId,
        cliente_id: clienteId,
        email,
        name: clientName || email,
        role: "administrador",
      },
      { onConflict: "id" },
    );

    if (userErr) {
      return { error: "Error al crear usuario autos: " + userErr.message };
    }
  }

  const role = (existingUser?.role as string | undefined) ?? "administrador";

  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    password,
    app_metadata: { role, cliente_id: clienteId, plan: tier },
  });

  if (authErr) {
    return { error: "Error al actualizar credenciales autos: " + authErr.message };
  }

  if (!clienteId) {
    return { error: "No se pudo resolver la concesionaria autos." };
  }

  await seedAutosClienteTheme(admin, clienteId);

  return { clienteId };
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

  const membership = await ensureInmoMembership(admin, params);
  if ("error" in membership) return membership;

  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const currentAppMetadata = userData.user?.app_metadata ?? {};

  const updatePayload: {
    password?: string;
    app_metadata: Record<string, unknown>;
  } = {
    app_metadata: {
      ...currentAppMetadata,
      org_id: membership.orgId,
      role: "admin",
      plan: tier,
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

  await seedInmoOrgProfileTheme(admin, membership.orgId, params.clientName, product);

  return { orgId: membership.orgId };
}

async function ensureTiendaAccess(
  admin: SupabaseClient,
  params: {
    userId: string;
    email: string;
    clientName: string;
    password: string;
    plan: string;
  },
): Promise<{ orgId: string } | { error: string }> {
  const { userId, email, clientName, password, plan } = params;
  const tier = planToTier(plan);

  const { data: orgId, error: rpcErr } = await admin.rpc("admin_ensure_tienda_membership", {
    p_user_id: userId,
    p_client_name: clientName,
    p_email: email,
    p_plan: plan,
    p_product: "tienda",
  });

  if (rpcErr) {
    return { error: "Error al asegurar membresía tienda: " + rpcErr.message };
  }

  if (!orgId) {
    return { error: "No se pudo resolver la organización tienda." };
  }

  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const currentAppMetadata = userData.user?.app_metadata ?? {};

  const updatePayload: {
    password?: string;
    app_metadata: Record<string, unknown>;
  } = {
    app_metadata: {
      ...currentAppMetadata,
      org_id: orgId,
      role: "admin",
      plan: tier,
      must_set_password: false,
    },
  };

  if (password) {
    updatePayload.password = password;
  }

  const { error: authErr } = await admin.auth.admin.updateUserById(userId, updatePayload);

  if (authErr) {
    return { error: "Error al actualizar credenciales tienda: " + authErr.message };
  }

  await seedTiendaOrgProfile(admin, orgId as string, clientName);
  await seedTiendaStore(admin, orgId as string, clientName);

  return { orgId: orgId as string };
}

function toStoreSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "mi-tienda"
  );
}

async function seedTiendaStore(
  admin: SupabaseClient,
  orgId: string,
  storeName: string,
): Promise<void> {
  const name = storeName.trim() || "Mi Tienda";
  const slug = toStoreSlug(name);

  const { data: existing } = await admin
    .schema("nodo_tienda")
    .from("stores")
    .select("id")
    .eq("org_id", orgId)
    .maybeSingle();

  if (existing) return;

  await admin.schema("nodo_tienda").from("stores").insert({
    org_id: orgId,
    slug,
    name,
    is_active: true,
  });
}

async function ensureTiendaClientUnitAccess(
  landingAdmin: SupabaseClient<any, any, any>,
  params: {
    userId: string;
    email: string;
    clientName: string;
    plan: string;
  },
): Promise<{ ok: true; clientId: string } | { error: string }> {
  const { userId, email, clientName, plan } = params;

  const { data: existingClient, error: clientLookupErr } = await landingAdmin
    .from("clients")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (clientLookupErr) {
    return { error: "Error al leer cliente: " + clientLookupErr.message };
  }

  let clientId = existingClient?.id as string | undefined;

  if (!clientId) {
    const { data: newClient, error: clientErr } = await landingAdmin
      .from("clients")
      .insert({
        name: clientName || email,
        email,
      })
      .select("id")
      .single();

    if (clientErr || !newClient) {
      return {
        error: "Error al crear cliente: " + (clientErr?.message ?? "sin respuesta"),
      };
    }

    clientId = newClient.id;
  }

  if (!clientId) {
    return { error: "No se pudo resolver el cliente." };
  }

  const resolvedClientId = clientId;

  const { data: existingUnit, error: unitLookupErr } = await landingAdmin
    .from("client_units")
    .select("id")
    .eq("client_id", resolvedClientId)
    .eq("unit_code", "tienda")
    .maybeSingle();

  if (unitLookupErr) {
    return { error: "Error al leer unidad tienda: " + unitLookupErr.message };
  }

  if (!existingUnit) {
    const { error: insertErr } = await landingAdmin.from("client_units").insert({
      client_id: resolvedClientId,
      unit_code: "tienda",
      plan,
      status: "activo",
      progress: 100,
      access_user: email,
      provision_user_id: userId,
      provisioned_at: new Date().toISOString(),
    });

    if (insertErr) {
      return { error: "Error al registrar unidad tienda: " + insertErr.message };
    }
  } else {
    const { error: updateErr } = await landingAdmin
      .from("client_units")
      .update({
        access_user: email,
        provision_user_id: userId,
        status: "activo",
        plan,
      })
      .eq("id", existingUnit.id);

    if (updateErr) {
      return { error: "Error al actualizar unidad tienda: " + updateErr.message };
    }
  }

  await syncNodeEmailAccessForClient(
    landingAdmin as Parameters<typeof syncNodeEmailAccessForClient>[0],
    resolvedClientId,
  );
  return { ok: true, clientId: resolvedClientId };
}

/** Re-sync tienda org membership, JWT claims, and dashboard access on SPA login. */
export async function syncTiendaUserClaims(params: {
  userId: string;
  email: string;
  clientName: string;
  plan?: string;
}): Promise<{ ok: true; org_id: string } | { ok: false; error: string }> {
  const admin = createNodoAdminClient("tienda");
  if (!admin) {
    return { ok: false, error: 'Nodo "tienda" no configurado.' };
  }

  const plan = params.plan ?? "starter";
  const membership = await ensureTiendaAccess(admin, {
    userId: params.userId,
    email: params.email,
    clientName: params.clientName,
    password: "",
    plan,
  });

  if ("error" in membership) {
    return { ok: false, error: membership.error };
  }

  const landingAdmin = createAdminClient();
  const unitAccess = await ensureTiendaClientUnitAccess(landingAdmin, {
    userId: params.userId,
    email: params.email,
    clientName: params.clientName,
    plan,
  });

  if ("error" in unitAccess) {
    return { ok: false, error: unitAccess.error };
  }

  return { ok: true, org_id: membership.orgId };
}

async function seedTiendaOrgProfile(
  admin: SupabaseClient,
  orgId: string,
  storeName: string,
): Promise<void> {
  const { data: existing } = await admin
    .schema("nodo_tienda")
    .from("org_profiles")
    .select("id")
    .eq("org_id", orgId)
    .maybeSingle();

  if (existing) return;

  await admin.schema("nodo_tienda").from("org_profiles").insert({
    org_id: orgId,
    store_name: storeName || "Mi Tienda",
    currency: "ARS",
    country: "AR",
    timezone: "America/Argentina/Buenos_Aires",
    theme_settings: getNodeDefaultTheme("Tienda"),
  });
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
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!found) return { ok: false, error: msg };
      userId = found.id;

      if (code === "finanzas") {
        const currentMeta = found.app_metadata ?? {};
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

      if (code === "tienda") {
        const tiendaResult = await ensureTiendaAccess(admin, {
          userId,
          email,
          clientName,
          password,
          plan,
        });
        if ("error" in tiendaResult) {
          return { ok: false, error: tiendaResult.error };
        }
        return {
          ok: true,
          existing: true,
          user_id: userId,
          org_id: tiendaResult.orgId,
        };
      }

      await admin.auth.admin.updateUserById(userId, { password });
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

  if (code === "tienda") {
    const tiendaResult = await ensureTiendaAccess(admin, {
      userId,
      email,
      clientName,
      password,
      plan,
    });

    if ("error" in tiendaResult) {
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: tiendaResult.error };
    }

    return { ok: true, user_id: userId, org_id: tiendaResult.orgId };
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
    const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matched = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (matched) {
      await admin.auth.admin.updateUserById(matched.id, {
        app_metadata: { role, must_set_password: true },
        user_metadata: { full_name: fullName },
      });
      return matched.id;
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
    const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matched = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (matched) {
      await admin.auth.admin.updateUserById(matched.id, {
        password,
        app_metadata: { role },
        user_metadata: { full_name: fullName },
      });
      return matched.id;
    }
  }

  console.error("ensureLandingAuthUser failed:", authErr);
  return null;
}
