import { NextRequest, NextResponse } from "next/server";
import { listInmoProperties } from "@/lib/obra/inmo-properties";
import { requireStaffSession } from "@/lib/obra/session";

export async function GET(request: NextRequest) {
  const session = await requireStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const properties = await listInmoProperties();
  return NextResponse.json({ properties });
}
