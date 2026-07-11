import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import {
  countUnreadDoctorNotifications,
  listDoctorNotifications,
  markDoctorNotificationsRead,
  type DoctorNotificationType,
} from "@/lib/clinic/doctor-notifications";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.user.role === "patient") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const me = await resolveProfessional(auth);
  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "all";
  const typesParam = searchParams.get("types");
  const types = typesParam
    ? (typesParam.split(",") as DoctorNotificationType[])
    : undefined;

  if (scope === "unread_count") {
    const count = await countUnreadDoctorNotifications(me.id, types);
    const cobrosCount = await countUnreadDoctorNotifications(me.id, [
      "mercadopago_payment",
      "transfer_pending",
    ]);
    return NextResponse.json({ count, cobrosCount });
  }

  const items = await listDoctorNotifications(me.id, {
    unreadOnly: scope === "unread",
    limit: 30,
  });

  const filtered = types?.length
    ? items.filter((n) => types.includes(n.type))
    : items;

  return NextResponse.json({ items: filtered });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (auth.user.role === "patient") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const me = await resolveProfessional(auth);
  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : undefined;
  const scope = body.scope as string | undefined;

  if (scope === "cobros") {
    const items = await listDoctorNotifications(me.id, { unreadOnly: true });
    const cobrosIds = items
      .filter(
        (n) =>
          n.type === "mercadopago_payment" || n.type === "transfer_pending",
      )
      .map((n) => n.id);
    const marked = await markDoctorNotificationsRead(me.id, cobrosIds);
    return NextResponse.json({ ok: true, marked });
  }

  const marked = await markDoctorNotificationsRead(me.id, ids);
  return NextResponse.json({ ok: true, marked });
}
