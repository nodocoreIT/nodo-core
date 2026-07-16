export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { getPatientHealthProfile } from "@/lib/clinic/db/patients";

// GET /api/clinic/patients/me
// Returns the authenticated patient's own profile including health data.
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  if (user.role !== "patient") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: patientRow, error: patientError } = await (supabase as any)
    .from("patients")
    .select("id, first_name, last_name, full_name, email, phone, profile_photo_url, dni, address")
    .eq("profile_id", user.id)
    .maybeSingle() as {
      data: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
        email: string | null;
        phone: string | null;
        profile_photo_url: string | null;
        dni: string | null;
        address: string | null;
      } | null;
      error: unknown;
    };

  // If no patient row exists fall back to Supabase user data with empty fields.
  if (patientError || !patientRow) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const userMeta = authUser?.user_metadata ?? {};
    const nameParts = (userMeta.full_name ?? "").split(/\s+/);
    return NextResponse.json({
      id: authUser?.id ?? user.id,
      firstName: nameParts[0] ?? "",
      lastName: nameParts.slice(1).join(" ") ?? "",
      fullName: userMeta.full_name ?? "",
      email: authUser?.email ?? user.email ?? "",
      phone: "",
      dni: "",
      address: "",
      profilePhotoUrl: null,
      bloodType: "",
      obraSocial: "",
      insuranceNumber: "",
      heightCm: null,
      weightKg: null,
      allergies: "",
      chronicConditions: "",
      medications: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
    });
  }

  const { data: hp } = await getPatientHealthProfile(supabase, patientRow.id);

  return NextResponse.json({
    id: patientRow.id,
    firstName: patientRow.first_name ?? "",
    lastName: patientRow.last_name ?? "",
    fullName: patientRow.full_name ?? `${patientRow.first_name ?? ""} ${patientRow.last_name ?? ""}`.trim(),
    email: patientRow.email ?? "",
    phone: patientRow.phone ?? "",
    dni: patientRow.dni ?? "",
    address: patientRow.address ?? "",
    profilePhotoUrl: patientRow.profile_photo_url ?? null,
    bloodType: hp?.blood_type ?? "",
    obraSocial: hp?.insurance_provider ?? "",
    insuranceNumber: hp?.insurance_number ?? "",
    heightCm: hp?.height_cm ?? null,
    weightKg: hp?.weight_kg ?? null,
    allergies: hp?.allergies ? hp.allergies.join(", ") : "",
    chronicConditions: hp?.chronic_conditions ? hp.chronic_conditions.join(", ") : "",
    medications: hp?.medications ?? "",
    emergencyContactName: hp?.emergency_contact_name ?? "",
    emergencyContactPhone: hp?.emergency_contact_phone ?? "",
  });
}
