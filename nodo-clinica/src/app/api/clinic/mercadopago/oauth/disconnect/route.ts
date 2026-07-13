import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Desconecta la cuenta de Mercado Pago del org (borra tokens de payment_credentials). */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!user.org_id) {
    return NextResponse.json({ error: "Org no encontrada" }, { status: 403 });
  }

  const supabase = await createServiceClient();

  // Remove the payment_credentials row for this org
  await supabase
    .from("payment_credentials")
    .delete()
    .eq("org_id", user.org_id);

  // Disable MP in office_settings.payment JSONB
  const { data: existing } = await supabase
    .from("office_settings")
    .select("payment")
    .eq("org_id", user.org_id)
    .maybeSingle();

  if (existing) {
    const payment = ((existing.payment as Record<string, unknown>) ?? {});
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
      .eq("org_id", user.org_id);
  }

  return NextResponse.json({ ok: true });
}
