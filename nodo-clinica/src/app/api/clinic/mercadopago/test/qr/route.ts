import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { doctorHasMercadoPagoConnection } from "@/lib/mercadopago/tokens";
import { createQrOrder, getQrOrder } from "@/lib/mercadopago/qr";
import { getDoctorMercadoPagoAccessToken } from "@/lib/mercadopago/tokens";
import { newId } from "@/lib/clinic/local-db";

export const dynamic = "force-dynamic";

/**
 * Crea una orden QR de prueba con el token OAuth del médico conectado.
 * POST { amount?: number }
 * GET ?orderId=... — consulta estado
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === session.userId);
  if (!doctor || !doctorHasMercadoPagoConnection(doctor)) {
    return NextResponse.json(
      { error: "Conectá Mercado Pago primero (OAuth)" },
      { status: 400 },
    );
  }

  const posId =
    doctor.payment?.mercadopagoExternalPosId?.trim() ||
    process.env.MERCADOPAGO_DEFAULT_EXTERNAL_POS_ID?.trim();

  if (!posId) {
    return NextResponse.json(
      {
        error:
          "Falta el ID de caja (external_pos_id). Configuralo en Cobros o MERCADOPAGO_DEFAULT_EXTERNAL_POS_ID.",
        helpUrl:
          "https://www.mercadopago.com.ar/developers/es/docs/qr-code/create-store-and-pos",
      },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const amount =
    typeof body.amount === "number" && body.amount > 0
      ? body.amount
      : doctor.payment?.consultationFee ?? 100;

  const token = await getDoctorMercadoPagoAccessToken(doctor);
  if (!token) {
    return NextResponse.json(
      { error: "No se pudo obtener Access Token del médico" },
      { status: 500 },
    );
  }

  const externalRef = `test-${newId("qr")}`;

  try {
    const order = await createQrOrder({
      accessToken: token,
      amount,
      currency: doctor.payment?.currency,
      description: `Prueba consulta — ${doctor.fullName}`,
      externalReference: externalRef,
      externalPosId: posId,
      mode: "dynamic",
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      status: order.status,
      qrData: order.qrData,
      externalReference: externalRef,
      amount,
      message:
        "Orden QR creada. Escaneá con la app de Mercado Pago (modo prueba) o usá qrData para renderizar.",
    });
  } catch (err) {
    console.error("[mp-test-qr] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear QR" },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId requerido" }, { status: 400 });
  }

  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === session.userId);
  if (!doctor) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const token = await getDoctorMercadoPagoAccessToken(doctor);
  if (!token) {
    return NextResponse.json({ error: "Sin token MP" }, { status: 400 });
  }

  try {
    const order = await getQrOrder(token, orderId);
    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 502 },
    );
  }
}
