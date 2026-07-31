import { NextRequest, NextResponse } from "next/server";
import {
  ingestMedicalDirectory,
  DIRECTORY_CATEGORIES,
  MEDICAL_DIRECTORY_CITY,
  type DirectoryCategory,
} from "@/lib/clinic/medical-directory";

export const maxDuration = 120;

/** Corre una vez al mes (ver vercel.json) — mantiene al día el directorio de
 * laboratorios / centros de diagnóstico por imágenes por si abre o cierra
 * algún local. Recorre todas las categorías en una sola corrida. */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const results: Record<string, { ok: boolean; count?: number; error?: string }> = {};
  for (const category of Object.keys(DIRECTORY_CATEGORIES) as DirectoryCategory[]) {
    results[category] = await ingestMedicalDirectory(MEDICAL_DIRECTORY_CITY, category);
    if (!results[category].ok) {
      console.error(`[cron/medical-directory] ${category}:`, results[category].error);
    }
  }

  const ok = Object.values(results).every((r) => r.ok);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 500 });
}
