// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppointmentByToken } from "@/lib/clinic/db/appointments";
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

  const supabase = await createClient();
  const { data: apt } = await getAppointmentByToken(supabase, accessToken);
  if (!apt) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  const row = apt as Record<string, unknown>;
  const paymentStatus = row.payment_status as string | null;
  if (paymentStatus === "confirmed" || paymentStatus === "waived") {
    return NextResponse.json({ ok: true, alreadyConfirmed: true });
  }

  if (!paymentId) {
    return NextResponse.json(
      { error: "paymentId requerido para sincronizar" },
      { status: 400 },
    );
  }

  const result = await processMercadoPagoPaymentId(paymentId);

  const { data: updated } = await supabase
    .from("appointments")
    .select("payment_status")
    .eq("id", row.id as string)
    .maybeSingle();

  return NextResponse.json({
    ...result,
    paymentStatus: (updated as Record<string, unknown> | null)?.payment_status,
  });
}
