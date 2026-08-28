import { NextRequest, NextResponse } from "next/server";
import { resolvePrescriptionByAccessToken } from "@/lib/clinic/prescription-token-auth";
import { buildCheckoutForPrescription } from "@/lib/mercadopago/prescription-checkout";

/**
 * Fase 4 of "Recetas" — obtiene (o regenera) la URL de checkout MP para una
 * receta standalone pendiente de pago. Mirrors GET /api/clinic/mercadopago
 * (turnos), but access is always via the receta's own access_token — a
 * valid, non-expired token is sufficient credential (magic-link style, no
 * login required), matching resolvePrescriptionByAccessToken's contract.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get("accessToken");

  if (!accessToken) {
    return NextResponse.json({ error: "accessToken requerido" }, { status: 400 });
  }

  const prescription = await resolvePrescriptionByAccessToken(accessToken);
  if (!prescription) {
    return NextResponse.json({ error: "Receta no encontrada" }, { status: 404 });
  }

  const paymentStatus = prescription.payment_status as string | null;
  if (paymentStatus === "confirmed" || paymentStatus === "waived") {
    return NextResponse.json({ paid: true });
  }

  const result = await buildCheckoutForPrescription(prescription.id);
  if (!result) {
    return NextResponse.json(
      { error: "Mercado Pago no configurado para este médico" },
      { status: 400 },
    );
  }

  return NextResponse.json(result);
}
