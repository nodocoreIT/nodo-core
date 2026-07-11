import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { createServiceClient } from "@/lib/supabase/server";

export type SessionRole = "doctor" | "patient";

export interface ClinicSession {
  userId: string;
  role: SessionRole;
  email: string;
  fullName: string;
}

const COOKIE = "clinica_session";
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
  secure: process.env.NODE_ENV === "production",
};

function sessionSecret(): Uint8Array {
  const raw =
    process.env.CLINIC_SESSION_SECRET ||
    process.env.CLINIC_ADMIN_SECRET ||
    "clinica-dev-session-secret-change-in-prod";
  return new TextEncoder().encode(raw);
}

async function signSessionPayload(session: ClinicSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(sessionSecret());
}

async function parseSignedSession(
  raw: string | undefined,
): Promise<ClinicSession | null> {
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, sessionSecret());
    const userId = payload.userId;
    const role = payload.role;
    const email = payload.email;
    const fullName = payload.fullName;
    if (
      typeof userId !== "string" ||
      (role !== "doctor" && role !== "patient") ||
      typeof email !== "string" ||
      typeof fullName !== "string"
    ) {
      return null;
    }
    return { userId, role, email, fullName };
  } catch {
    return null;
  }
}

async function validateSessionUser(
  session: ClinicSession,
): Promise<ClinicSession | null> {
  if (session.role === "doctor") {
    // Doctors are stored in nodo_clinica.professionals (Supabase).
    // Use service client to bypass RLS — this runs server-side only.
    // session.userId may be professionals.id (platform-sync) or auth user_id (clinic login).
    const supabase = await createServiceClient();
    const { data: professional } = await supabase
      .from("professionals")
      .select("id, email, full_name")
      .or(`id.eq.${session.userId},user_id.eq.${session.userId}`)
      .maybeSingle();

    if (!professional) return null;
    return {
      userId: professional.id,
      role: "doctor",
      email: professional.email,
      fullName: professional.full_name,
    };
  }

  // Patients: the JWT is signed by our server, so we trust it without a DB round-trip.
  // Users who have a nodo_clinica.patients row get enriched data; others fall back to the JWT.
  const patientClient = await createServiceClient();
  const { data: patient } = await patientClient
    .from("patients")
    .select("profile_id, email, full_name")
    .eq("profile_id", session.userId)
    .maybeSingle();

  return {
    userId: patient?.profile_id ?? session.userId,
    role: "patient",
    email: patient?.email ?? session.email,
    fullName: patient?.full_name ?? session.fullName,
  };
}

export async function jsonWithSession<T extends object>(
  data: T,
  session: ClinicSession | null,
): Promise<NextResponse> {
  const response = NextResponse.json(data);
  if (session) {
    const token = await signSessionPayload(session);
    response.cookies.set(COOKIE, token, COOKIE_OPTIONS);
  } else {
    response.cookies.delete(COOKIE);
  }
  return response;
}

export async function setSession(session: ClinicSession) {
  const cookieStore = await cookies();
  const token = await signSessionPayload(session);
  cookieStore.set(COOKIE, token, COOKIE_OPTIONS);
}

export async function getSession(): Promise<ClinicSession | null> {
  const cookieStore = await cookies();
  const parsed = await parseSignedSession(cookieStore.get(COOKIE)?.value);
  if (!parsed) return null;
  return validateSessionUser(parsed);
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<ClinicSession | null> {
  const parsed = await parseSignedSession(
    request.cookies.get(COOKIE)?.value,
  );
  if (!parsed) return null;
  return validateSessionUser(parsed);
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE);
}

export function clearSessionResponse(): NextResponse {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE);
  return response;
}
