import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/clinic/medico/pacientes/[patientId]/health-profile
 *
 * Update the patient's clinical header (antecedentes / alergias / medicación
 * habitual...). Current-state data, so this is an upsert (overwrite), NOT
 * append-only — that model belongs to the evolution log, not to "current
 * allergies". Only a doctor who has treated this patient may edit it.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const { patientId } = await params;
  const body = await request.json();

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const me = await resolveProfessional(authResult);
  if (!me) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = (await createServiceClient()) as any;

  // Authorization: this doctor must have at least one appointment with the
  // patient. Same scoping the read side uses (doctor_id = me.id).
  const { data: rel } = await svc
    .from("appointments")
    .select("id")
    .eq("doctor_id", me.id)
    .eq("patient_id", patientId)
    .limit(1)
    .maybeSingle();

  if (!rel) {
    return NextResponse.json(
      { error: "No tienes permisos sobre este paciente" },
      { status: 403 },
    );
  }

  // Whitelist editable header fields; ignore anything else in the payload.
  const toText = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : v === "" || v === null ? null : undefined;
  const toArray = (v: unknown) =>
    Array.isArray(v)
      ? v.map((x) => String(x).trim()).filter(Boolean)
      : v === null
        ? []
        : undefined;
  const toNumber = (v: unknown) =>
    v === null || v === "" ? null : typeof v === "number" ? v : Number.isFinite(Number(v)) ? Number(v) : undefined;

  const patch: Record<string, unknown> = { patient_id: patientId };
  const map: Array<[string, string, (v: unknown) => unknown]> = [
    ["bloodType", "blood_type", toText],
    ["allergies", "allergies", toArray],
    ["chronicConditions", "chronic_conditions", toArray],
    ["medications", "medications", toText],
    ["heightCm", "height_cm", toNumber],
    ["weightKg", "weight_kg", toNumber],
    ["insuranceProvider", "insurance_provider", toText],
    ["insuranceNumber", "insurance_number", toText],
    ["emergencyContactName", "emergency_contact_name", toText],
    ["emergencyContactPhone", "emergency_contact_phone", toText],
  ];
  for (const [inKey, col, coerce] of map) {
    if (inKey in body) {
      const value = coerce(body[inKey]);
      if (value !== undefined) patch[col] = value;
    }
  }
  patch.updated_at = new Date().toISOString();

  const { data: saved, error } = await svc
    .from("patient_health_profiles")
    .upsert(patch, { onConflict: "patient_id" })
    .select(
      "blood_type, allergies, chronic_conditions, medications, height_cm, weight_kg, " +
        "insurance_provider, insurance_number, emergency_contact_name, emergency_contact_phone, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    bloodType: saved.blood_type ?? null,
    allergies: saved.allergies ?? null,
    chronicConditions: saved.chronic_conditions ?? null,
    medications: saved.medications ?? null,
    heightCm: saved.height_cm ?? null,
    weightKg: saved.weight_kg ?? null,
    insuranceProvider: saved.insurance_provider ?? null,
    insuranceNumber: saved.insurance_number ?? null,
    emergencyContactName: saved.emergency_contact_name ?? null,
    emergencyContactPhone: saved.emergency_contact_phone ?? null,
    updatedAt: saved.updated_at ?? null,
  });
}
