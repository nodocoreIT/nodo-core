import "server-only";
import { createHash, randomInt } from "crypto";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID?.trim();
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim();
const TWILIO_SMS_FROM = process.env.TWILIO_SMS_FROM?.trim();

export function isSmsConfigured(): boolean {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_SMS_FROM);
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export function hashOtpCode(code: string): string {
  const secret =
    process.env.CLINIC_PHONE_OTP_SECRET ??
    process.env.CLINIC_SESSION_SECRET ??
    "clinica-dev-phone-otp";
  return createHash("sha256").update(`${secret}:${code}`).digest("hex");
}

export function verifyOtpHash(code: string, hash: string): boolean {
  return hashOtpCode(code) === hash;
}

export async function sendPhoneOtpSms(params: {
  toE164: string;
  code: string;
}): Promise<{ mock?: boolean }> {
  const body = `NODO Clínica: tu código de verificación es ${params.code}. Vence en 10 minutos.`;

  if (!isSmsConfigured()) {
    console.warn("[SMS Mock] OTP para", params.toE164, "→", params.code);
    return { mock: true };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString(
    "base64",
  );

  const form = new URLSearchParams({
    To: params.toE164,
    From: TWILIO_SMS_FROM!,
    Body: body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[SMS] Twilio error", res.status, errText);
    throw new Error("No se pudo enviar el SMS. Reintentá en unos minutos.");
  }

  return {};
}
