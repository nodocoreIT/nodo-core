import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface AuthContext {
  user: {
    id: string;
    email: string | undefined;
    role: string;
    org_id: string | null;
  };
  supabase: SupabaseClient<Database>;
}

/**
 * Authenticates the incoming request via Supabase session.
 *
 * Returns an AuthContext with the verified user and a ready supabase client,
 * or a NextResponse with status 401 if the session is missing or invalid.
 *
 * Usage in an API route:
 *   const result = await requireAuth();
 *   if (result instanceof NextResponse) return result;
 *   const { user, supabase } = result;
 */
export async function requireAuth(
  _request?: NextRequest,
): Promise<AuthContext | NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appMeta = user.app_metadata ?? {};

  return {
    user: {
      id: user.id,
      email: user.email,
      role: appMeta.role ?? "patient",
      org_id: appMeta.org_id ?? null,
    },
    supabase,
  };
}
