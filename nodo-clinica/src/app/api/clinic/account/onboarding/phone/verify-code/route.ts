import { NextRequest, NextResponse } from "next/server";
import { verifyOnboardingPhoneCode } from "@/lib/clinic/phone-verification";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const code = String(body.code ?? "").trim();

    if (!token || !phone || !code) {
      return NextResponse.json(
        { error: "token, phone y code son requeridos" },
        { status: 400 },
      );
    }

    const result = await verifyOnboardingPhoneCode(token, phone, code);

    return NextResponse.json({
      ok: true,
      verified: result.verified,
      phoneE164: result.phoneE164,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al verificar código";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
