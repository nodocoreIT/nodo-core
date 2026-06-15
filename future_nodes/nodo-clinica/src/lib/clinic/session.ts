import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/clinic/local-db";

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

export function jsonWithSession<T extends object>(
  data: T,
  session: ClinicSession | null
): NextResponse {
  const response = NextResponse.json(data);
  if (session) {
    response.cookies.set(COOKIE, JSON.stringify(session), COOKIE_OPTIONS);
  } else {
    response.cookies.delete(COOKIE);
  }
  return response;
}

export async function setSession(session: ClinicSession) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE, JSON.stringify(session), COOKIE_OPTIONS);
}

export async function getSession(): Promise<ClinicSession | null> {
  const cookieStore = await cookies();
  return parseSession(cookieStore.get(COOKIE)?.value);
}

export async function getSessionFromRequest(
  request: NextRequest
): Promise<ClinicSession | null> {
  const fromCookie = parseSession(request.cookies.get(COOKIE)?.value);
  if (fromCookie) return fromCookie;

  const userId = request.headers.get("x-clinic-user-id");
  const role = request.headers.get("x-clinic-role") as SessionRole | null;
  const email = request.headers.get("x-clinic-email");
  const fullName = request.headers.get("x-clinic-name");

  if (!userId || (role !== "doctor" && role !== "patient")) {
    return null;
  }

  const db = await readDb();
  if (role === "doctor") {
    const doctor = db.doctors.find((d) => d.id === userId);
    if (!doctor) return null;
    return {
      userId: doctor.id,
      role: "doctor",
      email: doctor.email,
      fullName: doctor.fullName,
    };
  }

  const patient = db.patients.find((p) => p.id === userId);
  if (!patient) return null;
  return {
    userId: patient.id,
    role: "patient",
    email: patient.email,
    fullName: patient.fullName,
  };
}

function parseSession(raw: string | undefined): ClinicSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ClinicSession;
  } catch {
    return null;
  }
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
