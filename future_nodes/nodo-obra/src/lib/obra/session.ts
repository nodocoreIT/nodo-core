import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/obra/local-db";

export type ObraSessionRole = "staff" | "cliente";

export interface ObraSession {
  userId: string;
  role: ObraSessionRole;
  email: string;
  fullName: string;
}

const COOKIE = "nodo_obra_session";
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
  secure: process.env.NODE_ENV === "production",
};

function parseSession(raw?: string): ObraSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ObraSession;
    if (!parsed.userId || !parsed.role || !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function jsonWithSession<T extends object>(
  data: T,
  session: ObraSession | null,
): NextResponse {
  const response = NextResponse.json(data);
  if (session) {
    response.cookies.set(COOKIE, JSON.stringify(session), COOKIE_OPTIONS);
  } else {
    response.cookies.delete(COOKIE);
  }
  return response;
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<ObraSession | null> {
  const session = parseSession(request.cookies.get(COOKIE)?.value);
  if (!session) return null;

  const db = await readDb();
  if (session.role === "staff") {
    if (!db.staff.some((s) => s.id === session.userId)) return null;
  } else if (!db.clientes.some((c) => c.id === session.userId)) {
    return null;
  }
  return session;
}

export async function requireStaffSession(
  request: NextRequest,
): Promise<ObraSession | null> {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "staff") return null;
  return session;
}

export function clearSessionResponse(): NextResponse {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE);
  return response;
}

export async function getServerSession(): Promise<ObraSession | null> {
  const cookieStore = await cookies();
  return parseSession(cookieStore.get(COOKIE)?.value);
}
