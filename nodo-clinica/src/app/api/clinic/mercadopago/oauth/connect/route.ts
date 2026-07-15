import { NextRequest, NextResponse } from "next/server";
import { isLocalMode } from "@/lib/clinic/config";
import { writeDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { requireAuth } from "@/lib/supabase/auth-guard";
import {
  buildAuthorizationUrl,
  generatePkcePair,
  getMpOAuthConfig,
  isPkceEnabled,
  newOAuthState,
} from "@/lib/mercadopago/oauth";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Inicia OAuth: redirige al médico a Mercado Pago para autorizar la app. */
export async function GET(request: NextRequest) {
  const config = getMpOAuthConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Mercado Pago no está configurado en la plataforma." },
      { status: 503 },
    );
  }

  const usePkce = isPkceEnabled();
  const pkce = usePkce ? generatePkcePair() : null;
  const codeVerifier = pkce?.codeVerifier ?? "";
  const state = newOAuthState();
  const now = new Date().toISOString();

  if (isLocalMode()) {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "doctor") {
      return NextResponse.json({ error: "Iniciá sesión como médico" }, { status: 401 });
    }

    await writeDb((db) => {
      const doctor = db.doctors.find((d) => d.id === session.userId);
      if (!doctor) return;
      doctor.payment = {
        ...(doctor.payment ?? { currency: "ARS", requirePaymentBeforeBooking: true }),
        mercadopagoEnabled: true,
        mercadopagoOAuthPending: {
          state,
          codeVerifier,
          createdAt: now,
        },
      };
    });

    return NextResponse.redirect(
      buildAuthorizationUrl({
        config,
        state,
        codeChallenge: pkce?.codeChallenge,
      }),
    );
  }

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!user.org_id) {
    return NextResponse.json({ error: "Org no encontrada" }, { status: 403 });
  }

  const supabase = await createServiceClient();
  const { data: existing } = await supabase
    .from("office_settings")
    .select("payment")
    .eq("org_id", user.org_id)
    .maybeSingle();

  const payment = (existing?.payment as Record<string, unknown>) ?? {};
  await supabase
    .from("office_settings")
    .update({
      payment: {
        ...payment,
        mercadopagoEnabled: true,
        mercadopagoOAuthPending: { state, codeVerifier, createdAt: now },
      },
    })
    .eq("org_id", user.org_id);

  return NextResponse.redirect(
    buildAuthorizationUrl({
      config,
      state,
      codeChallenge: pkce?.codeChallenge,
    }),
  );
}
