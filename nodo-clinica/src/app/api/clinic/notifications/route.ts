import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/clinic/session";
import {
  countUnreadDoctorNotifications,
  listDoctorNotifications,
  markDoctorNotificationsRead,
} from "@/lib/clinic/doctor-notifications";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "all";
  const typesParam = searchParams.get("types");
  const types = typesParam
    ? (typesParam.split(",") as Array<"mercadopago_payment" | "transfer_pending" | "general">)
    : undefined;

  if (scope === "unread_count") {
    const count = await countUnreadDoctorNotifications(session.userId, types);
    const cobrosCount = await countUnreadDoctorNotifications(session.userId, [
      "mercadopago_payment",
      "transfer_pending",
    ]);
    return NextResponse.json({ count, cobrosCount });
  }

  const items = await listDoctorNotifications(session.userId, {
    unreadOnly: scope === "unread",
    limit: 30,
  });

  const filtered = types?.length
    ? items.filter((n) => types.includes(n.type))
    : items;

  return NextResponse.json({ items: filtered });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : undefined;
  const scope = body.scope as string | undefined;

  if (scope === "cobros") {
    const items = await listDoctorNotifications(session.userId, {
      unreadOnly: true,
    });
    const cobrosIds = items
      .filter((n) => n.type === "mercadopago_payment" || n.type === "transfer_pending")
      .map((n) => n.id);
    const marked = await markDoctorNotificationsRead(session.userId, cobrosIds);
    return NextResponse.json({ ok: true, marked });
  }

  const marked = await markDoctorNotificationsRead(session.userId, ids);
  return NextResponse.json({ ok: true, marked });
}
