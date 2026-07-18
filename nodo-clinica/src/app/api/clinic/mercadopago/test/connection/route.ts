import { NextRequest, NextResponse } from "next/server";
import { isLocalMode } from "@/lib/clinic/config";
import { getProfessionalMercadoPagoAccessToken } from "@/lib/clinic/db/payments";
import { readDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { getDoctorMercadoPagoAccessToken } from "@/lib/mercadopago/tokens";
import {
  getMercadoPagoUser,
  mercadoPagoTokenKind,
} from "@/lib/mercadopago/client";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";

export const dynamic = "force-dynamic";

/** Verifica que el token MP del médico logueado sea válido. */
export async function GET(request: NextRequest) {
  let token: string | undefined;

  if (isLocalMode()) {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "doctor") {
      return NextResponse.json(
        { error: "Iniciá sesión como médico" },
        { status: 401 },
      );
    }

    const db = await readDb();
    const doctor = db.doctors.find((d) => d.id === session.userId);
    if (!doctor) {
      return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
    }

    token = await getDoctorMercadoPagoAccessToken(doctor);
  } else {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (auth.user.role !== "doctor") {
      return NextResponse.json(
        { error: "Iniciá sesión como médico" },
        { status: 401 },
      );
    }

    if (!auth.user.org_id) {
      return NextResponse.json({ error: "Org no encontrada" }, { status: 403 });
    }

    const professional = await resolveProfessional(auth);
    if (!professional) {
      return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
    }

    token = await getProfessionalMercadoPagoAccessToken(professional.id);
  }

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No hay cuenta vinculada. Usá «Vincular mi cuenta de Mercado Pago» en Cobros.",
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
