import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/obra/local-db";
import { buildDashboard } from "@/lib/obra/stats";
import { requireStaffSession } from "@/lib/obra/session";

export async function GET(request: NextRequest) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = await readDb();
  return NextResponse.json(buildDashboard(db));
}
