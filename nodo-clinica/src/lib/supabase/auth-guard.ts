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

  if (auth._professionalId) {
    // Fast path: came from ClinicSession — we already have the professional id
    // Use service client to bypass RLS
    const serviceClient = await createServiceClient();
    const { data } = await serviceClient
      .from("professionals")
      .select("id, email")
      .eq("id", auth._professionalId)
      .maybeSingle();
    return data ?? null;
  }

  // Supabase auth path: look up by user_id (or fall back to id for flexibility)
  const { data } = await auth.supabase
    .from("professionals")
    .select("id, email")
    .or(`user_id.eq.${auth.user.id},id.eq.${auth.user.id}`)
    .maybeSingle();
  return data ?? null;
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
  if (isLocalMode()) {
    const clinicSession = await getSession();
    if (!clinicSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sessionRole =
      clinicSession.role === "doctor" ? "doctor" : "patient";
    return {
      user: {
        id: clinicSession.userId,
        email: clinicSession.email,
        role: sessionRole,
        org_id: null,
      },
      _professionalId:
        clinicSession.role === "doctor" ? clinicSession.userId : null,
      supabase: null as unknown as SupabaseClient<Database>,
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!error && user) {
    const appMeta = user.app_metadata ?? {};
    return {
      user: {
        id: user.id,
        email: user.email,
        role: appMeta.role ?? "patient",
        org_id: appMeta.org_id ?? null,
      },
      _professionalId: null,
      supabase,
    };
  }

  // Fallback: ClinicSession JWT cookie
  // getSession() runs validateSessionUser() which normalises userId to
  // professionals.id for doctors, so _professionalId is reliable.
  const clinicSession = await getSession();
  if (clinicSession) {
    const sessionRole =
      clinicSession.role === "doctor" ? "doctor" : "patient";
    return {
      user: {
        id: clinicSession.userId,
        email: clinicSession.email,
        role: sessionRole,
        org_id: null,
      },
      _professionalId:
        clinicSession.role === "doctor" ? clinicSession.userId : null,
      supabase,
    };
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
