import { NextRequest, NextResponse } from "next/server";
import { searchVademecum } from "@/lib/clinic/vademecum";

/** Búsqueda de medicamentos — vademécum nacional (Argly) con fallback local. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.min(
    20,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 12)),
  );

  const payload = await searchVademecum(q, limit);
  return NextResponse.json(payload);
}
