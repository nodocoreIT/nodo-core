import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { isPaymentConfirmed } from "@/lib/clinic/payment";
import { buildCheckoutForAppointment } from "@/lib/mercadopago/checkout";

/** Obtiene o regenera URL de checkout MP para un turno pendiente. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get("accessToken");
  const appointmentId = searchParams.get("appointmentId");

  const session = await getSessionFromRequest(request);
  const db = await readDb();

  const apt = accessToken
    ? db.appointments.find((a) => a.accessToken === accessToken)
    : appointmentId
      ? db.appointments.find((a) => a.id === appointmentId)
      : undefined;

  if (!apt) {
    return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  }

  if (session?.role === "patient" && session.userId !== apt.patientId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (isPaymentConfirmed(apt)) {
    return NextResponse.json({
      paid: true,
      waitingRoomUrl: `/paciente/sala/${apt.accessToken}`,
    });
  }

  const result = await buildCheckoutForAppointment(apt.id);
  if (!result) {
    return NextResponse.json(
      { error: "Mercado Pago no configurado para este médico" },
      { status: 400 }
    );
  }

  return NextResponse.json(result);
}
