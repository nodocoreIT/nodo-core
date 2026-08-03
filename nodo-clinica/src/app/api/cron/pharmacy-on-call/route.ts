import { NextRequest, NextResponse } from "next/server";
import {
  getPharmacySchedule,
  ingestPharmacyScheduleForMonth,
  shouldRunScheduledIngest,
} from "@/lib/clinic/pharmacy-on-call";

// El geocoding de cada farmacia (Nominatim, 1 req/seg) puede sumar 30-40s.
export const maxDuration = 60;

/** Reintenta traer el turnero en los primeros días hábiles del mes si aún no está cargado. */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const existing = await getPharmacySchedule(year, month);
  if (existing) {
    return NextResponse.json({ ok: true, skipped: true, reason: "already_loaded" });
  }

  if (!shouldRunScheduledIngest(now)) {
    return NextResponse.json({ ok: true, skipped: true, reason: "outside_business_day_window" });
  }

  const result = await ingestPharmacyScheduleForMonth(year, month);

  if (!result.ok) {
    console.error("[cron/pharmacy-on-call]", result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
