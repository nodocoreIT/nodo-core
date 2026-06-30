import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import {
  buildAuthorizationUrl,
  generatePkcePair,
  getMpOAuthConfig,
  newOAuthState,
} from "@/lib/mercadopago/oauth";

export const dynamic = "force-dynamic";

/** Inicia OAuth: redirige al médico a Mercado Pago para autorizar la app. */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "Iniciá sesión como médico" }, { status: 401 });
  }

  const config = getMpOAuthConfig();
  if (!config) {
    return NextResponse.json(
      {
        error:
          "OAuth no configurado. Definí MERCADOPAGO_CLIENT_ID y MERCADOPAGO_CLIENT_SECRET.",
      },
      { status: 503 },
    );
  }

  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = newOAuthState();
  const now = new Date().toISOString();

  await writeDb((db) => {
    const doctor = db.doctors.find((d) => d.id === session.userId);
    if (!doctor) return;
    doctor.payment = {
      ...(doctor.payment ?? {}),
      mercadopagoEnabled: true,
      mercadopagoOAuthPending: {
        state,
        codeVerifier,
        createdAt: now,
      },
    };
  });

  const url = buildAuthorizationUrl({
    config,
    state,
    codeChallenge,
  });

  return NextResponse.redirect(url);
}
