import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export interface ResolvedSupabaseAuth {
  user: User;
  accessToken?: string;
}

function bearerFromRequest(request?: NextRequest): string | null {
  const header = request?.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** Cookie session first, then Authorization Bearer (browser client fallback). */
export async function resolveSupabaseAuthUser(
  request?: NextRequest,
): Promise<ResolvedSupabaseAuth | null> {
  const supabase = await createClient();
  const bearer = bearerFromRequest(request);

  const [
    { data: { user: cookieUser }, error: cookieError },
    { data: { session } },
  ] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);

  if (!cookieError && cookieUser) {
    return { user: cookieUser, accessToken: session?.access_token ?? bearer ?? undefined };
  }

  if (!bearer) return null;

  const svc = await createServiceClient();
  const {
    data: { user: bearerUser },
    error: bearerError,
  } = await svc.auth.getUser(bearer);

  if (bearerError || !bearerUser) return null;
  return { user: bearerUser, accessToken: bearer };
}
