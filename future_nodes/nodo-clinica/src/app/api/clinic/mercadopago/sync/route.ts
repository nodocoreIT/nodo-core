import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/clinic/local-db";
import { processMercadoPagoPaymentId } from "@/lib/mercadopago/handle-payment-webhook";

export const dynamic = "force-dynamic";

/** Confirma pago MP al volver del checkout (respaldo si el webhook tarda). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const accessToken = (body as { accessToken?: string }).accessToken?.trim();
  const paymentId =
    (body as { paymentId?: string }).paymentId?.trim() ||
    new URL(request.url).searchParams.get("payment_id")?.trim();

  if (!accessToken) {
    return NextResponse.json({ error: "accessToken requerido" }, { status: 400 });
  }

  const db = await readDb();
  const apt = db.appointments.find((a) => a.accessToken === accessToken);
  if (!apt) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  if (apt.paymentStatus === "confirmed" || apt.paymentStatus === "waived") {
    return NextResponse.json({ ok: true, alreadyConfirmed: true });
  }

  if (!paymentId) {
    return NextResponse.json(
      { error: "paymentId requerido para sincronizar" },
      { status: 400 },
    );
  }

  const result = await processMercadoPagoPaymentId(paymentId, {
    appointmentIdHint: apt.id,
  });
  const updated = (await readDb()).appointments.find((a) => a.id === apt.id);

  return NextResponse.json({
    ...result,
    paymentStatus: updated?.paymentStatus,
  });
}
