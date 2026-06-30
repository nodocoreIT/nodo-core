import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { getDoctorMercadoPagoAccessToken } from "@/lib/mercadopago/tokens";
import {
  getMercadoPagoUser,
  mercadoPagoTokenKind,
} from "@/lib/mercadopago/client";

export const dynamic = "force-dynamic";

/** Verifica que el token MP del médico logueado sea válido. */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "Iniciá sesión como médico" }, { status: 401 });
  }

  const db = await readDb();
  const doctor = db.doctors.find((d) => d.id === session.userId);
  if (!doctor) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  const token = await getDoctorMercadoPagoAccessToken(doctor);
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No hay Access Token. Conectá Mercado Pago (OAuth) o pegá un token de prueba en Cobros.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await getMercadoPagoUser(token);
    return NextResponse.json({
      ok: true,
      tokenKind: mercadoPagoTokenKind(token),
      userId: user.id,
      nickname: user.nickname,
      liveMode: user.live_mode,
      message:
        mercadoPagoTokenKind(token) === "test"
          ? "Token de prueba OK — listo para cobrar en sandbox."
          : "Token de producción OK — los cobros van a tu cuenta real.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        tokenKind: mercadoPagoTokenKind(token),
        error:
          err instanceof Error
            ? err.message
            : "Token rechazado por Mercado Pago",
      },
      { status: 400 },
    );
  }
}
