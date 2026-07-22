import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { appointmentNeedsDoctorPaymentReviewFromDbRow } from "@/lib/clinic/payment";
import {
  countUnreadDoctorNotifications,
  listDoctorNotifications,
  markDoctorNotificationsRead,
  type DoctorNotificationType,
} from "@/lib/clinic/doctor-notifications";

/**
 * The "cobros" badge used to count unread doctor_notifications rows, a
 * separate inbox-style system that gets out of sync with the real state of
 * each turno (approving/rejecting a payment doesn't mark its notification
 * read, so a stale row kept the badge stuck). Count directly from
 * appointments instead — the exact same source of truth the Cobros table
 * uses for needsReview, so they can never disagree.
 */
async function countPendingCobros(professionalId: string): Promise<number> {
  const svc = await createServiceClient();
  const { data } = await svc
    .from("appointments")
    .select("status, payment_status, payment_provider, payment_receipt_audit, patient_documents(id)")
    .eq("doctor_id", professionalId);

  return (data ?? []).filter((apt) =>
    appointmentNeedsDoctorPaymentReviewFromDbRow(apt as never, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      receiptDocumentCount: ((apt as any).patient_documents ?? []).length,
    }),
  ).length;
}

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
    const cobrosCount = await countPendingCobros(me.id);
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

  const marked = await markDoctorNotificationsRead(me.id, ids);
  return NextResponse.json({ ok: true, marked });
}
