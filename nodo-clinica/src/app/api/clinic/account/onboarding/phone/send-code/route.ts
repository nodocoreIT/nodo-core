import { NextRequest, NextResponse } from "next/server";
import { sendOnboardingPhoneCode } from "@/lib/clinic/phone-verification";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token ?? "").trim();
    const phone = String(body.phone ?? "").trim();

    if (!token || !phone) {
      return NextResponse.json(
        { error: "token y phone son requeridos" },
        { status: 400 },
      );
    }

    const result = await sendOnboardingPhoneCode(token, phone);

    return NextResponse.json({
      ok: true,
      phoneE164: result.phoneE164,
      mock: result.mock ?? false,
      devCode: result.devCode,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al enviar código";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
