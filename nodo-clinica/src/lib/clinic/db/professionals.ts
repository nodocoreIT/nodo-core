import { createServiceClient } from "@/lib/supabase/server";
import { isUnassignedSpecialty } from "@/lib/clinic/unassigned-specialty";

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
