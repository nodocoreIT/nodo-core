import type { SupabaseClient } from "@supabase/supabase-js";
import { getLandingAuthConfig, getNodoAuthConfig } from "@/lib/supabase/nodo-admin";

type AuthUserMatch = {
  userId: string;
  appMetadata: Record<string, unknown>;
};

type AuthProjectConfig = {
  url: string;
  serviceRoleKey: string;
};

/** O(1) lookup on auth.users (service role). */
async function findAuthUserByEmailFromAuthSchema(
  authAdmin: SupabaseClient<any, any, any>,
  email: string,
): Promise<AuthUserMatch | null> {
  const normalized = email.trim().toLowerCase();

  const { data, error } = await authAdmin
    .schema("auth")
    .from("users")
    .select("id, raw_app_meta_data, email")
    .ilike("email", normalized)
    .maybeSingle();

  if (error || !data?.id) return null;

  return {
    userId: data.id,
    appMetadata: (data.raw_app_meta_data as Record<string, unknown>) ?? {},
  };
}

async function findAuthUserByEmailPaginated(
  authAdmin: SupabaseClient<any, any, any>,
  email: string,
): Promise<AuthUserMatch | null> {
  const normalized = email.trim().toLowerCase();

  for (let page = 1; page <= 3; page++) {
    const { data, error } = await authAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;

    const matched = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (matched) {
      return {
        userId: matched.id,
        appMetadata: matched.app_metadata ?? {},
      };
    }

    if (data.users.length < 200) break;
  }

  return null;
}

/** Resolves auth user id by email — auth.users first, then GoTrue filter, then listUsers. */
export async function findAuthUserByEmail(
  config: AuthProjectConfig,
  email: string,
  fallbackAdmin?: SupabaseClient<any, any, any>,
): Promise<AuthUserMatch | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  if (fallbackAdmin) {
    const fromSchema = await findAuthUserByEmailFromAuthSchema(fallbackAdmin, email);
    if (fromSchema) return fromSchema;
  }

  const filter = encodeURIComponent(`email.eq.${normalized}`);

  try {
    const res = await fetch(`${config.url}/auth/v1/admin/users?page=1&per_page=1&filter=${filter}`, {
      headers: {
        Authorization: `Bearer ${config.serviceRoleKey}`,
        apikey: config.serviceRoleKey,
      },
      cache: "no-store",
    });

    if (res.ok) {
      const json = (await res.json()) as {
        users?: Array<{ id: string; app_metadata?: Record<string, unknown> }>;
      };
      const user = json.users?.[0];
      if (user?.id) {
        return {
          userId: user.id,
          appMetadata: user.app_metadata ?? {},
        };
      }
    }
  } catch {
    // Fall through.
  }

  if (fallbackAdmin) {
    return findAuthUserByEmailPaginated(fallbackAdmin, email);
  }

  return null;
}

export function authConfigForNodoCode(nodoCode: string): AuthProjectConfig | null {
  return getNodoAuthConfig(nodoCode) ?? getLandingAuthConfig();
}

export function authConfigForUnitCode(unitCode: string): AuthProjectConfig | null {
  return authConfigForNodoCode(unitCode);
}
