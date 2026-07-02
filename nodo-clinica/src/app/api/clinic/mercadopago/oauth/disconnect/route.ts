import { NextRequest, NextResponse } from "next/server";
import { writeDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";

export const dynamic = "force-dynamic";

/** Desconecta la cuenta de Mercado Pago del médico (borra tokens en servidor). */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session || session.role !== "doctor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await writeDb((db) => {
    const doctor = db.doctors.find((d) => d.id === session.userId);
    if (!doctor) return;
    doctor.payment = {
      ...(doctor.payment ?? {}),
      mercadopagoEnabled: false,
      mercadopagoAccessToken: undefined,
      mercadopagoRefreshToken: undefined,
      mercadopagoTokenExpiresAt: undefined,
      mercadopagoUserId: undefined,
      mercadopagoPublicKey: undefined,
      mercadopagoConnectedAt: undefined,
      mercadopagoOAuthPending: undefined,
    };
  });

  return NextResponse.json({ ok: true });
}
