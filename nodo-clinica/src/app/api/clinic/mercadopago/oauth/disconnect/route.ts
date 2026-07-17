import { NextRequest, NextResponse } from "next/server";
import { isLocalMode } from "@/lib/clinic/config";
import { writeDb } from "@/lib/clinic/local-db";
import { getSessionFromRequest } from "@/lib/clinic/session";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Desconecta la cuenta de Mercado Pago del médico/org. */
export async function POST(request: NextRequest) {
  if (isLocalMode()) {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "doctor") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await writeDb((db) => {
      const doctor = db.doctors.find((d) => d.id === session.userId);
      if (!doctor?.payment) return;
      doctor.payment.mercadopagoEnabled = false;
      delete doctor.payment.mercadopagoOAuthPending;
      delete doctor.payment.mercadopagoAccessToken;
      delete doctor.payment.mercadopagoRefreshToken;
      delete doctor.payment.mercadopagoTokenExpiresAt;
      delete doctor.payment.mercadopagoUserId;
      delete doctor.payment.mercadopagoPublicKey;
      delete doctor.payment.mercadopagoConnectedAt;
    });

    return NextResponse.json({ ok: true });
  }

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

  const supabase = await createServiceClient();

  await supabase.from("payment_credentials").delete().eq("org_id", user.org_id);

  const { data: existing } = await supabase
    .from("office_settings")
    .select("payment")
    .eq("professional_id", professional.id)
    .maybeSingle();

  if (existing) {
    const payment = (existing.payment as Record<string, unknown>) ?? {};
    const cleaned: Record<string, unknown> = { ...payment };
    cleaned.mercadopagoEnabled = false;
    delete cleaned.mercadopagoOAuthPending;
    delete cleaned.mercadopagoAccessToken;
    delete cleaned.mercadopagoRefreshToken;
    delete cleaned.mercadopagoTokenExpiresAt;
    delete cleaned.mercadopagoPublicKey;
    delete cleaned.mercadopagoUserId;
    delete cleaned.mercadopagoConnectedAt;

    await supabase
      .from("office_settings")
      .update({ payment: cleaned })
      .eq("professional_id", professional.id);
  }

  return NextResponse.json({ ok: true });
}
