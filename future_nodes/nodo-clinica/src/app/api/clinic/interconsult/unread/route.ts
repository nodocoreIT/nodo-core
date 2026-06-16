import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { isProPlan } from "@/lib/nodo-chat/is-pro-plan";
import { getUnreadMessages } from "@/lib/nodo-chat/unread";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = await readDb();
  const me = db.doctors.find((d) => d.id === session.userId);
  if (!me || !isProPlan(me.subscriptionPlan)) {
    return NextResponse.json({ count: 0, items: [] });
  }

  const lastReadAt = db.nodoChatReadAt?.[session.userId] ?? null;
  const unread = getUnreadMessages(
    db.interconsultMessages ?? [],
    session.userId,
    lastReadAt,
  ).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return NextResponse.json({
    count: unread.length,
    items: unread.slice(0, 5).map((m) => ({
      id: m.id,
      fromDoctorId: m.fromDoctorId,
      fromDoctorName: m.fromDoctorName,
      toDoctorId: m.toDoctorId,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
}
