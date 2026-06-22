import { NextRequest, NextResponse } from "next/server";
import { searchMedications } from "@/lib/clinic/medication-catalog";

/** Búsqueda de medicamentos — catálogo local; extensible a Vademécum/Alfabeta. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const results = searchMedications(q);

  // Hook futuro: if (process.env.VADEMECUM_API_URL) { ... }

  return NextResponse.json({
    results,
    source: "local",
    hint:
      results.length === 0 && q.length >= 2
        ? "Sin coincidencias en catálogo local. Podés escribir el medicamento manualmente."
        : undefined,
  });
}
