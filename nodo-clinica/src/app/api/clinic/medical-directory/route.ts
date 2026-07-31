import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import {
  getMedicalDirectory,
  ingestMedicalDirectory,
  isDirectoryCategory,
  MEDICAL_DIRECTORY_CITY,
} from "@/lib/clinic/medical-directory";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  if (!category || !isDirectoryCategory(category)) {
    return NextResponse.json({ error: "category inválida" }, { status: 400 });
  }

  let entries = await getMedicalDirectory(MEDICAL_DIRECTORY_CITY, category);

  // Fallback on-demand: si todavía no corrió el cron (o falló) para esta
  // categoría, lo disparamos para el primer paciente que entra.
  if (entries.length === 0) {
    const result = await ingestMedicalDirectory(MEDICAL_DIRECTORY_CITY, category);
    if (result.ok) {
      entries = await getMedicalDirectory(MEDICAL_DIRECTORY_CITY, category);
    } else {
      console.error(`[clinic/medical-directory] fallback ingest failed (${category}):`, result.error);
    }
  }

  return NextResponse.json({ entries });
}
