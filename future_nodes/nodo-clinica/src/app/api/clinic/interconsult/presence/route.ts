import { NextRequest, NextResponse } from "next/server";
import {
  readDb,
  writeDb,
  ONLINE_THRESHOLD_MS,
  publicDoctorSummary,
} from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = await readDb();
  const now = Date.now();

  const doctors = db.doctors
    .filter((d) => d.id !== session.userId)
    .map((d) => {
      const presence = db.doctorPresence?.[d.id];
      const lastSeen = presence?.lastSeen
        ? new Date(presence.lastSeen).getTime()
        : 0;
      const online = now - lastSeen < ONLINE_THRESHOLD_MS;
      return {
        ...publicDoctorSummary(d),
        online,
        lastSeen: presence?.lastSeen ?? null,
      };
    })
    .sort((a, b) => Number(b.online) - Number(a.online));

  return NextResponse.json({ doctors });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await writeDb((db) => {
    if (!db.doctorPresence) db.doctorPresence = {};
    db.doctorPresence[session.userId] = {
      doctorId: session.userId,
      lastSeen: new Date().toISOString(),
    };
  });

  return NextResponse.json({ ok: true });
}
