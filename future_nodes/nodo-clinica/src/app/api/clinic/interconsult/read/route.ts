import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { isProPlan } from "@/lib/nodo-chat/is-pro-plan";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = await readDb();
  const me = db.doctors.find((d) => d.id === session.userId);
  if (!me || !isProPlan(me.subscriptionPlan)) {
    return NextResponse.json({ error: "Plan Pro requerido" }, { status: 403 });
  }

  const now = new Date().toISOString();
  await writeDb((state) => {
    if (!state.nodoChatReadAt) state.nodoChatReadAt = {};
    state.nodoChatReadAt[session.userId] = now;
  });

  return NextResponse.json({ readAt: now });
}
