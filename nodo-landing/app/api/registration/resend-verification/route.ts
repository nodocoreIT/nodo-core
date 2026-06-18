import { resendVerificationEmail } from "@/app/actions/registration";
import { normalizeUnitCode } from "@/lib/registration/node-config";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim();
  const unitCode = normalizeUnitCode(String(body.unitCode ?? body.unit_code ?? ""));

  if (!email || !unitCode) {
    return Response.json(
      { status: "error", message: "Email y nodo son obligatorios." },
      { status: 400 },
    );
  }

  const origin = String(body.origin ?? request.headers.get("origin") ?? "").trim() || undefined;
  const result = await resendVerificationEmail({ email, unitCode, origin });

  return Response.json(result, {
    status: result.status === "error" ? 400 : 200,
  });
}
