import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/clinic/session";
import { isLocalMode } from "@/lib/clinic/config";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface AuthContext {
  user: {
    id: string;
    email: string | undefined;
    role: string;
    org_id: string | null;
  };
  /**
   * Direct professional.id (PK) when auth came from ClinicSession.
   * Null when auth came from Supabase (routes should look up by user_id).
   * Use resolveProfessionalId(auth) to get the right id in either case.
   */
  _professionalId: string | null;
  supabase: SupabaseClient<Database>;
}

/**
 * Resolves the professional row for the authenticated doctor.
 * Handles both auth paths:
 *   - Supabase auth: user.id is the auth user_id → look up by user_id
 *   - ClinicSession: _professionalId is professionals.id → look up by id
 *
 * Always uses the service client to bypass RLS — this is safe because
 * requireAuth already verified the user's identity.
 *
 * Returns null if no professional row is found.
 */
export async function resolveProfessional(
  auth: AuthContext,
): Promise<{ id: string; email: string } | null> {
  if (isLocalMode() && auth._professionalId) {
    return {
      id: auth._professionalId,
      email: auth.user.email ?? "",
    };
  }

  // Always use service client to bypass RLS for this critical lookup.
  // requireAuth already authenticated the user — we trust auth.user.id.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;

  if (auth._professionalId) {
    // Fast path: came from ClinicSession — we already have the professional id
    const { data } = await svc
      .from("professionals")
      .select("id, email")
      .eq("id", auth._professionalId)
      .maybeSingle();
    return (data as { id: string; email: string } | null) ?? null;
  }

  // Supabase auth path: look up by user_id first
  const { data: byUserId } = await svc
    .from("professionals")
    .select("id, email")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (byUserId) return byUserId as { id: string; email: string };

  // Email fallback: handles cases where user_id was not set at onboarding time.
  // Auto-heals by writing user_id so future lookups use the fast path.
  if (auth.user.email) {
    const { data: byEmail } = await svc
      .from("professionals")
      .select("id, email")
      .eq("email", auth.user.email)
      .maybeSingle();

    if (byEmail) {
      const prof = byEmail as { id: string; email: string };
      // Silently link user_id for future requests
      await svc
        .from("professionals")
        .update({ user_id: auth.user.id })
        .eq("id", prof.id);
      return prof;
    }
  }

  return null;
}

/**
 * Authenticates the incoming request.
 *
 * Primary:  Supabase session cookie (supabase.auth.getUser)
 * Fallback: ClinicSession JWT cookie (set by login / platform-sync routes)
 *
 * Returns an AuthContext with the verified user and a ready supabase client,
 * or a NextResponse with status 401 if neither auth method succeeds.
 */
export async function requireAuth(
  _request?: NextRequest,
): Promise<AuthContext | NextResponse> {
  // 1. Try Supabase auth first — works in production and any env with Supabase configured.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (!error && user) {
      const appMeta = user.app_metadata ?? {};
      const supabaseRole: string = appMeta.role ?? "patient";

      // Check ClinicSession cookie in parallel — a privileged user (doctor/admin)
      // may have explicitly chosen to act as "patient". If the ClinicSession is for
      // the same auth user and carries role "patient", honour that choice (downgrade
      // only — never allow escalation via this path).
      const clinicSession = await getSession();
      const effectiveRole =
        clinicSession?.userId === user.id && clinicSession?.role === "patient"
          ? "patient"
          : supabaseRole;

      return {
        user: {
          id: user.id,
          email: user.email,
          role: effectiveRole,
          org_id: appMeta.org_id ?? null,
        },
        _professionalId: null,
        supabase,
      };
    }

    // 2. Fallback: ClinicSession JWT cookie (platform-sync logins or local mode).
    const clinicSession = await getSession();
    if (clinicSession) {
      const sessionRole = clinicSession.role === "doctor" ? "doctor" : "patient";
      return {
        user: {
          id: clinicSession.userId,
          email: clinicSession.email,
          role: sessionRole,
          org_id: null,
        },
        _professionalId: clinicSession.role === "doctor" ? clinicSession.userId : null,
        supabase,
      };
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Local demo mode (no Supabase configured) — ClinicSession only.
  const clinicSession = await getSession();
  if (!clinicSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sessionRole = clinicSession.role === "doctor" ? "doctor" : "patient";
  return {
    user: {
      id: clinicSession.userId,
      email: clinicSession.email,
      role: sessionRole,
      org_id: null,
    },
    _professionalId: clinicSession.role === "doctor" ? clinicSession.userId : null,
    supabase: null as unknown as SupabaseClient<Database>,
  };
}
