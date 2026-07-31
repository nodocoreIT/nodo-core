import { NextRequest, NextResponse } from "next/server";
import { ingestPharmacyScheduleForMonth } from "@/lib/clinic/pharmacy-on-call";

// El geocoding de cada farmacia (Nominatim, 1 req/seg) puede sumar 30-40s.
export const maxDuration = 60;

/** Corre el día 1 de cada mes (ver vercel.json) — trae el turnero de farmacias del mes actual. */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const now = new Date();
  const result = await ingestPharmacyScheduleForMonth(
    now.getFullYear(),
    now.getMonth() + 1,
  );

  if (!result.ok) {
    console.error("[cron/pharmacy-on-call]", result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
