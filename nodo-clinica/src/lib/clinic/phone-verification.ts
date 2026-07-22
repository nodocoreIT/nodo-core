import { createServiceClient } from "@/lib/supabase/server";
import {
  generateOtpCode,
  hashOtpCode,
  sendPhoneOtpSms,
  verifyOtpHash,
} from "@/lib/sms";
import { normalizeArMobilePhone } from "@/lib/clinic/phone-utils";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_WINDOW_MS = 15 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 3;

type PendingRow = {
  id: string;
  email: string;
  role: string;
  onboarding_token: string | null;
  phone_e164: string | null;
  phone_verified_at: string | null;
};

async function getPendingByOnboardingToken(token: string): Promise<PendingRow | null> {
  const service = await createServiceClient();
  const { data, error } = await service
    .from("pending_clinic_registrations")
    .select("id, email, role, onboarding_token, phone_e164, phone_verified_at")
    .eq("onboarding_token", token)
    .maybeSingle();

  if (error || !data?.onboarding_token) return null;
  return data as PendingRow;
}

export async function sendOnboardingPhoneCode(
  onboardingToken: string,
  rawPhone: string,
): Promise<{ phoneE164: string; mock?: boolean; devCode?: string }> {
  const pending = await getPendingByOnboardingToken(onboardingToken);
  if (!pending) {
    throw new Error("Sesión de registro inválida o expirada.");
  }

  const phoneE164 = normalizeArMobilePhone(rawPhone);
  if (!phoneE164) {
    throw new Error("Ingresá un celular válido (ej. 11 1234-5678).");
  }

  const service = await createServiceClient();
  const since = new Date(Date.now() - MAX_SENDS_WINDOW_MS).toISOString();

  const { count } = await service
    .from("phone_verification_challenges")
    .select("*", { count: "exact", head: true })
    .eq("onboarding_token", onboardingToken)
    .gte("created_at", since);

  if ((count ?? 0) >= MAX_SENDS_PER_WINDOW) {
    throw new Error("Demasiados intentos. Esperá 15 minutos y volvé a intentar.");
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { error: insertError } = await service.from("phone_verification_challenges").insert({
    onboarding_token: onboardingToken,
    phone_e164: phoneE164,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error("[phone-verification] insert challenge", insertError);
    throw new Error("No se pudo generar el código.");
  }

  const sendResult = await sendPhoneOtpSms({ toE164: phoneE164, code });

  return {
    phoneE164,
    mock: sendResult.mock,
    devCode: sendResult.mock ? code : undefined,
  };
}

export async function verifyOnboardingPhoneCode(
  onboardingToken: string,
  rawPhone: string,
  code: string,
): Promise<{ phoneE164: string; verified: true }> {
  const pending = await getPendingByOnboardingToken(onboardingToken);
  if (!pending) {
    throw new Error("Sesión de registro inválida o expirada.");
  }

  const phoneE164 = normalizeArMobilePhone(rawPhone);
  if (!phoneE164) {
    throw new Error("Celular inválido.");
  }

  const normalizedCode = code.replace(/\D/g, "").trim();
  if (normalizedCode.length !== 6) {
    throw new Error("El código debe tener 6 dígitos.");
  }

  const service = await createServiceClient();
  const { data: challenge, error } = await service
    .from("phone_verification_challenges")
    .select("id, code_hash, expires_at, attempt_count, verified_at")
    .eq("onboarding_token", onboardingToken)
    .eq("phone_e164", phoneE164)
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !challenge) {
    throw new Error("No hay código activo. Pedí uno nuevo.");
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    throw new Error("El código expiró. Pedí uno nuevo.");
  }

  if ((challenge.attempt_count ?? 0) >= MAX_ATTEMPTS) {
    throw new Error("Superaste los intentos. Pedí un código nuevo.");
  }

  const valid = verifyOtpHash(normalizedCode, challenge.code_hash);

  await service
    .from("phone_verification_challenges")
    .update({ attempt_count: (challenge.attempt_count ?? 0) + 1 })
    .eq("id", challenge.id);

  if (!valid) {
    throw new Error("Código incorrecto.");
  }

  const now = new Date().toISOString();

  await service
    .from("phone_verification_challenges")
    .update({ verified_at: now })
    .eq("id", challenge.id);

  await service
    .from("pending_clinic_registrations")
    .update({ phone_e164: phoneE164, phone_verified_at: now })
    .eq("id", pending.id);

  return { phoneE164, verified: true };
}

export async function assertOnboardingPhoneVerified(
  onboardingToken: string,
): Promise<string> {
  const pending = await getPendingByOnboardingToken(onboardingToken);
  if (!pending?.phone_verified_at || !pending.phone_e164) {
    throw new Error("Verificá tu número de celular antes de continuar.");
  }
  return pending.phone_e164;
}
