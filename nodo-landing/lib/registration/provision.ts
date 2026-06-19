import type { SupabaseClient } from "@supabase/supabase-js";
import { createNodoAdminClient } from "@/lib/supabase/nodo-admin";

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

  return { clienteId };
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
        await admin.auth.admin.updateUserById(userId, {
          password,
          app_metadata: { role: "user", plan: planToTier(plan) },
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

      return { ok: true, existing: true, user_id: userId };
    }
    return { ok: false, error: msg };
  }

  userId = created.user!.id;

  if (code === "inmo" || code === "clínica" || code === "clinica" || code === "salud") {
    const product =
      code === "inmo" ? "inmo" : "clinica";

    const { data: org, error: orgErr } = await admin
      .schema("shared")
      .from("organizations")
      .insert({
        name: clientName || email,
        tier: planToTier(plan),
        product,
      })
      .select("id")
      .single();

    if (orgErr || !org) {
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: "Error al crear organización: " + (orgErr?.message ?? "") };
    }

    await admin
      .schema("shared")
      .from("user_profiles")
      .insert({ id: userId, full_name: clientName || email });

    const { error: memberErr } = await admin
      .schema("shared")
      .from("org_members")
      .insert({ org_id: org.id, user_id: userId, role: "admin" });

    if (memberErr) {
      await admin.schema("shared").from("organizations").delete().eq("id", org.id);
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: "Error al crear membresía: " + memberErr.message };
    }

    return { ok: true, user_id: userId, org_id: org.id };
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
      app_metadata: { role: "user", plan: planToTier(plan) },
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
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    app_metadata: { must_set_password: false },
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
