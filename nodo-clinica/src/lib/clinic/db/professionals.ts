import { createServiceClient } from "@/lib/supabase/server";
import { isUnassignedSpecialty } from "@/lib/clinic/unassigned-specialty";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  const msg = error.message ?? "";
  return (
    /column .* does not exist/i.test(msg) ||
    /could not find the .* column of .* in the schema cache/i.test(msg)
  );
}

export interface ProfessionalOnboardingInput {
  userId: string;
  orgId: string;
  fullName: string;
  email: string;
  specialty: string;
  licenseNumber?: string | null;
  plan: string;
  phone?: string | null;
  phoneVerifiedAt?: string | null;
}

export async function upsertProfessionalOnboardingRecord(
  supabase: AnyClient,
  input: ProfessionalOnboardingInput,
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const email = input.email.toLowerCase().trim();
  const nameParts = input.fullName.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || firstName;

  const basePayload: Record<string, unknown> = {
    user_id: input.userId,
    org_id: input.orgId,
    first_name: firstName,
    last_name: lastName,
    full_name: input.fullName.trim(),
    email,
    specialty: input.specialty,
    specialties: [input.specialty],
    license_number: input.licenseNumber ?? null,
    subscription_status: "trial",
    subscription_plan: input.plan,
  };

  async function findExistingProfessionalId(): Promise<string | undefined> {
    const { data: byUser } = await supabase
      .from("professionals")
      .select("id")
      .eq("user_id", input.userId)
      .maybeSingle();

    if (byUser?.id) return byUser.id as string;

    const { data: byEmail } = await supabase
      .from("professionals")
      .select("id, user_id")
      .ilike("email", email)
      .maybeSingle();

    if (byEmail?.id) {
      const linkedUser = byEmail.user_id as string | null;
      if (!linkedUser || linkedUser === input.userId) {
        return byEmail.id as string;
      }
    }

    return undefined;
  }

  async function writePayload(
    payload: Record<string, unknown>,
  ): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
    const existingId = await findExistingProfessionalId();

    if (existingId) {
      const { error } = await supabase
        .from("professionals")
        .update(payload)
        .eq("id", existingId);
      if (error) return { ok: false, error: error.message, code: error.code };
      return { ok: true };
    }

    const { error: insertError } = await supabase.from("professionals").insert(payload);

    if (!insertError) return { ok: true };

    if (insertError.code === "23505") {
      const duplicateId = await findExistingProfessionalId();
      if (duplicateId) {
        const { error: updateError } = await supabase
          .from("professionals")
          .update(payload)
          .eq("id", duplicateId);
        if (updateError) {
          return { ok: false, error: updateError.message, code: updateError.code };
        }
        return { ok: true };
      }
    }

    return { ok: false, error: insertError.message, code: insertError.code };
  }

  const payloadVariants: Record<string, unknown>[] = input.phone
    ? [
        { ...basePayload, phone: input.phone, phone_verified_at: input.phoneVerifiedAt },
        { ...basePayload, phone: input.phone },
        basePayload,
      ]
    : [basePayload];

  let lastResult: { ok: true } | { ok: false; error: string; code?: string } = {
    ok: false,
    error: "No se pudo crear el perfil profesional.",
  };

  for (const payload of payloadVariants) {
    lastResult = await writePayload(payload);
    if (lastResult.ok) return lastResult;
    if (!isMissingColumnError({ code: lastResult.code, message: lastResult.error })) {
      return lastResult;
    }
  }

  return lastResult;
}

export type BookableProfessional = {
  id: string;
  org_id: string;
  full_name: string;
  email: string | null;
  specialty: string | null;
  subscription_status: string | null;
};

export type ProfessionalOfficeSettings = {
  payment?: Record<string, unknown> | null;
  availability?: { slotDurationMinutes?: number; days?: unknown[]; blockedDates?: string[] } | null;
  reminder_settings?: Record<string, unknown> | null;
};

/** Load doctor + office settings for patient booking (bypasses org RLS). */
export async function getBookableProfessional(doctorId: string): Promise<{
  professional: BookableProfessional;
  officeSettings: ProfessionalOfficeSettings | null;
} | null> {
  const service = await createServiceClient();

  const { data: professional } = await service
    .from("professionals")
    .select("id, org_id, full_name, email, specialty, subscription_status")
    .eq("id", doctorId)
    .maybeSingle();

  if (!professional || isUnassignedSpecialty(professional.specialty)) {
    return null;
  }
  if (professional.subscription_status === "expired") {
    return null;
  }

  const { data: officeSettings } = await service
    .from("office_settings")
    .select("payment, availability, reminder_settings")
    .eq("professional_id", doctorId)
    .maybeSingle();

  return {
    professional: professional as BookableProfessional,
    officeSettings: (officeSettings as ProfessionalOfficeSettings | null) ?? null,
  };
}
