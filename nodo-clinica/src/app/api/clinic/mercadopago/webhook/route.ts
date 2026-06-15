import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/clinic/local-db";
import {
  confirmAppointmentPaymentAndNotify,
  doctorMercadoPagoToken,
} from "@/lib/clinic/appointment-payment";
import { getPayment } from "@/lib/mercadopago/client";

/** Webhook IPN de Mercado Pago — confirma el turno al aprobarse el pago. */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let paymentId =
    searchParams.get("data.id") ||
    searchParams.get("id") ||
    searchParams.get("data_id");

  if (!paymentId) {
    try {
      const body = await request.json();
      paymentId =
        body?.data?.id?.toString() ||
        body?.id?.toString() ||
        (typeof body?.data === "object" ? body.data?.id?.toString() : undefined);
    } catch {
      /* notificación solo por query */
    }
  }

  if (!paymentId) {
    return NextResponse.json({ ok: true, skipped: "no payment id" });
  }

  const db = await readDb();

  for (const doctor of db.doctors) {
    const token = doctorMercadoPagoToken(doctor);
    if (!token) continue;

    try {
      const payment = await getPayment(token, paymentId);
      if (payment.status !== "approved") continue;

      const appointmentId = payment.external_reference;
      if (!appointmentId) continue;

      const apt = db.appointments.find((a) => a.id === appointmentId);
      if (!apt || apt.doctorId !== doctor.id) continue;

      await confirmAppointmentPaymentAndNotify(appointmentId, {
        mercadopagoPaymentId: String(payment.id),
      });

      return NextResponse.json({ ok: true, appointmentId });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ ok: true, skipped: "payment not matched" });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
