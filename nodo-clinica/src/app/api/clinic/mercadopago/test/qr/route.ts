import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { getDoctorMercadoPagoAccessToken, professionalHasMercadoPagoConnection } from "@/lib/mercadopago/tokens";
import { createQrOrder, getQrOrder } from "@/lib/mercadopago/qr";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Crea una orden QR de prueba con el token OAuth del org conectado.
 * POST { amount?: number }
 * GET ?orderId=... — consulta estado
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  if (!user.org_id) {
    return NextResponse.json({ error: "Org no encontrada" }, { status: 403 });
  }

  const professional = await resolveProfessional(auth);
  if (!professional) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const hasConnection = await professionalHasMercadoPagoConnection(professional.id);
  if (!hasConnection) {
    return NextResponse.json(
      { error: "Conectá Mercado Pago primero (OAuth)" },
      { status: 400 },
    );
  }

  const { data: officeSettings } = await supabase
    .from("office_settings")
    .select("payment")
    .eq("professional_id", professional.id)
    .maybeSingle();

  const payment = (officeSettings?.payment as Record<string, unknown>) ?? {};
  const posId =
    (payment.mercadopagoExternalPosId as string | undefined)?.trim() ||
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
  const fee = typeof payment.consultationFee === "number" ? payment.consultationFee : 100;
  const amount =
    typeof body.amount === "number" && body.amount > 0 ? body.amount : fee;

  const token = await getDoctorMercadoPagoAccessToken(professional.id);
  if (!token) {
    return NextResponse.json(
      { error: "No se pudo obtener Access Token del médico" },
      { status: 500 },
    );
  }

  const { data: professionalName } = await supabase
    .from("professionals")
    .select("full_name")
    .eq("id", professional.id)
    .maybeSingle();

  const externalRef = `test-qr-${randomUUID()}`;

  try {
    const order = await createQrOrder({
      accessToken: token,
      amount,
      currency: (payment.currency as string | undefined),
      description: `Prueba consulta — ${professionalName?.full_name ?? "Médico"}`,
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
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!user.org_id) {
    return NextResponse.json({ error: "Org no encontrada" }, { status: 403 });
  }

  const professional = await resolveProfessional(auth);
  if (!professional) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId requerido" }, { status: 400 });
  }

  const token = await getDoctorMercadoPagoAccessToken(professional.id);
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
