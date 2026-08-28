import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { resolvePrescriptionAccess } from "@/lib/clinic/prescription-access";

/**
 * Resolves what a patient landing on a receta magic link should see.
 * A patient session is OPTIONAL here — this is a public, token-gated page
 * (mirrors the /api/clinic/mercadopago GET's accessToken-first handling),
 * so requireAuth() failing must not turn into a 401: it just means "no
 * session", which is itself a valid state (→ needs_login/needs_registration).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "token requerido" }, { status: 400 });
  }

  let sessionPatientId: string | null = null;

  const authResult = await requireAuth(request);
  if (!(authResult instanceof NextResponse) && authResult.user.role === "patient") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServiceClient()) as any;
    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("profile_id", authResult.user.id)
      .maybeSingle();
    sessionPatientId = patient?.id ?? null;
  }

  const result = await resolvePrescriptionAccess(token, sessionPatientId);
  return NextResponse.json(result);
}
