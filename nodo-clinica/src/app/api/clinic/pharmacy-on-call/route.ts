import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import {
  getPharmacySchedule,
  ingestPharmacyScheduleForMonth,
} from "@/lib/clinic/pharmacy-on-call";

// El geocoding de cada farmacia (Nominatim, 1 req/seg) puede sumar 30-40s
// cuando este endpoint dispara la ingesta on-demand — el default de Vercel
// se queda corto.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const now = new Date();
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "year/month inválidos" }, { status: 400 });
  }

  let schedule = await getPharmacySchedule(year, month);

  // Solo reintentamos la ingesta on-demand para el mes ACTUAL — si el cron
  // todavía no corrió o falló, esto cubre al primer paciente que entra ese
  // día. Para meses pasados/futuros sin datos, no tiene sentido pegarle a
  // Gemini por algo que puede no existir todavía.
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  if (!schedule && isCurrentMonth) {
    const result = await ingestPharmacyScheduleForMonth(year, month);
    if (result.ok) {
      schedule = await getPharmacySchedule(year, month);
    } else {
      console.error("[clinic/pharmacy-on-call] fallback ingest failed:", result.error);
    }
  }

  return NextResponse.json({ schedule });
}
