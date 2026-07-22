import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getPatients,
  getPatientById,
  updatePatient,
  upsertHealthProfile,
  type PatientUpdate,
} from "@/lib/clinic/db/patients";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const patientId = searchParams.get("patientId");

  if (patientId) {
    // Return single patient with stats
    const { data: patient, error } = await getPatientById(
      supabase,
      patientId,
      user.org_id ?? "",
    );
    if (error || !patient) {
      return NextResponse.json(
        { error: "Paciente no encontrado" },
        { status: 404 },
      );
    }

    // Fetch related counts
    const [{ count: aptCount }, { count: docCount }, { count: recCount }] =
      await Promise.all([
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("patient_id", patientId)
          .eq("org_id", user.org_id ?? ""),
        supabase
          .from("patient_documents")
          .select("*", { count: "exact", head: true })
          .eq("patient_id", patientId)
          .eq("org_id", user.org_id ?? ""),
        supabase
          .from("clinical_records")
          .select("*", { count: "exact", head: true })
          .eq("patient_id", patientId)
          .eq("org_id", user.org_id ?? ""),
      ]);

    const { data: lastApt } = await supabase
      .from("appointments")
      .select("scheduled_at")
      .eq("patient_id", patientId)
      .eq("org_id", user.org_id ?? "")
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      id: patient.id,
      fullName: patient.full_name,
      email: patient.email,
      phone: patient.phone,
      profilePhotoUrl: patient.profile_photo_url,
      dateOfBirth: patient.date_of_birth,
      medicalRecordNumber: patient.medical_record_number,
      createdAt: patient.created_at,
      stats: {
        appointments: aptCount ?? 0,
        documents: docCount ?? 0,
        clinicalRecords: recCount ?? 0,
      },
      lastAppointment: lastApt?.scheduled_at ?? null,
    });
  }

  // List patients for the org
  if (!user.org_id) {
    return NextResponse.json({ error: "org_id requerido" }, { status: 403 });
  }

  const { data: patients, error } = await getPatients(
    supabase,
    user.org_id,
    q ?? undefined,
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For each patient, attach basic stats + last appointment
  const results = await Promise.all(
    (patients ?? []).map(async (patient) => {
      const [{ count: aptCount }, { count: docCount }, { count: recCount }, { data: lastApt }] =
        await Promise.all([
          supabase
            .from("appointments")
            .select("*", { count: "exact", head: true })
            .eq("patient_id", patient.id)
            .eq("org_id", user.org_id ?? ""),
          supabase
            .from("patient_documents")
            .select("*", { count: "exact", head: true })
            .eq("patient_id", patient.id)
            .eq("org_id", user.org_id ?? ""),
          supabase
            .from("clinical_records")
            .select("*", { count: "exact", head: true })
            .eq("patient_id", patient.id)
            .eq("org_id", user.org_id ?? ""),
          supabase
            .from("appointments")
            .select("scheduled_at, status")
            .eq("patient_id", patient.id)
            .eq("org_id", user.org_id ?? "")
            .order("scheduled_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      return {
        id: patient.id,
        fullName: patient.full_name,
        email: patient.email,
        phone: patient.phone,
        dni: patient.dni ?? null,
        profilePhotoUrl: patient.profile_photo_url,
        createdAt: patient.created_at,
        stats: {
          appointments: aptCount ?? 0,
          documents: docCount ?? 0,
          clinicalRecords: recCount ?? 0,
        },
        lastAppointment: lastApt?.scheduled_at ?? null,
        lastStatus: lastApt?.status ?? null,
      };
    }),
  );

  return NextResponse.json(results);
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  const body = await request.json();
  const { profilePhotoUrl, profilePhotoData, firstName, lastName, fullName, phone, dni, address, healthProfile } = body as {
    /** Legacy field — base64 data URI (kept for backward compat) */
    profilePhotoData?: string;
    /** Direct URL (storage-backed) */
    profilePhotoUrl?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    phone?: string;
    dni?: string;
    address?: string;
    healthProfile?: {
      // camelCase from client
      bloodType?: string | null;
      obraSocial?: string | null;       // maps to insurance_provider
      insuranceNumber?: string | null;  // maps to insurance_number
      allergies?: string | null;        // free-text, stored as [value]
      chronicConditions?: string | null;
      heightCm?: number | null;
      weightKg?: number | null;
      medications?: string | null;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
    };
  };

  // Patients update their own profile; doctors can update any patient in org
  if (user.role === "patient") {
    // Use service client for all patient self-update operations to bypass RLS.
    // Security is already guaranteed by requireAuth above.
    const svc = await createServiceClient();

    // Find the patient row linked to the auth user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data: patientRow } = await (svc as any)
      .from("patients")
      .select("id, org_id")
      .eq("profile_id", user.id)
      .maybeSingle() as { data: { id: string; org_id: string | null } | null; error: unknown };

    // Auto-create the patient row if it doesn't exist yet.
    // This covers: (a) doctor acting as patient, (b) patient whose profile_id
    // was never linked after Supabase registration.
    if (!patientRow) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const userMeta = authUser?.user_metadata ?? {};
      const newFullName: string = (fullName?.trim()) || userMeta.full_name || user.email?.split("@")[0] || "";

      // Split full_name into first_name / last_name (nullable after migration 20260716b)
      const nameParts = newFullName.trim().split(/\s+/);
      const firstName = nameParts[0] || null;
      const lastName = nameParts.slice(1).join(" ") || null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: created, error: createError } = await (svc as any)
        .from("patients")
        .insert({
          profile_id: user.id,
          email: user.email,
          first_name: firstName,
          last_name: lastName,
          full_name: newFullName || null,
          org_id: user.org_id ?? null,
        })
        .select("id, org_id")
        .single() as { data: { id: string; org_id: string | null } | null; error: { message: string } | null };

      if (!created) {
        console.error("[patients PUT] auto-create failed:", createError?.message);
        return NextResponse.json({ error: `No se pudo crear el perfil: ${createError?.message}` }, { status: 500 });
      }
      patientRow = created;
    }

    // Build patient-level update (only defined fields)
    const patientUpdate: PatientUpdate = {};
    if (profilePhotoUrl !== undefined) patientUpdate.profile_photo_url = profilePhotoUrl;
    if (profilePhotoData !== undefined) patientUpdate.profile_photo_url = profilePhotoData;
    if (firstName !== undefined) patientUpdate.first_name = firstName.trim() || null;
    if (lastName !== undefined) patientUpdate.last_name = lastName.trim() || null;
    if (firstName !== undefined || lastName !== undefined) {
      patientUpdate.full_name = `${firstName ?? ""} ${lastName ?? ""}`.trim() || null;
    } else if (fullName !== undefined && fullName.trim()) {
      patientUpdate.full_name = fullName.trim();
    }
    if (phone !== undefined) patientUpdate.phone = phone;
    if (dni !== undefined) patientUpdate.dni = dni.trim() || null;
    if (address !== undefined) patientUpdate.address = address.trim() || null;

    if (Object.keys(patientUpdate).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc as any)
        .from("patients")
        .update(patientUpdate)
        .eq("id", patientRow.id);
    }

    // Convert camelCase health profile to snake_case for DB
    if (healthProfile !== undefined) {
      const toArray = (val: string | null | undefined): string[] | null => {
        if (val == null || val.trim() === "") return null;
        return [val.trim()];
      };

      const { error: hpError } = await upsertHealthProfile(svc, {
        patient_id: patientRow.id,
        ...(healthProfile.bloodType !== undefined && { blood_type: healthProfile.bloodType || null }),
        ...(healthProfile.obraSocial !== undefined && { insurance_provider: healthProfile.obraSocial || null }),
        ...(healthProfile.insuranceNumber !== undefined && { insurance_number: healthProfile.insuranceNumber || null }),
        ...(healthProfile.allergies !== undefined && { allergies: toArray(healthProfile.allergies) }),
        ...(healthProfile.chronicConditions !== undefined && { chronic_conditions: toArray(healthProfile.chronicConditions) }),
        ...(healthProfile.heightCm !== undefined && { height_cm: healthProfile.heightCm }),
        ...(healthProfile.weightKg !== undefined && { weight_kg: healthProfile.weightKg }),
        ...(healthProfile.medications !== undefined && { medications: healthProfile.medications }),
        ...(healthProfile.emergencyContactName !== undefined && { emergency_contact_name: healthProfile.emergencyContactName }),
        ...(healthProfile.emergencyContactPhone !== undefined && { emergency_contact_phone: healthProfile.emergencyContactPhone }),
      });

      if (hpError) {
        console.error("[patients PUT] upsertHealthProfile failed:", hpError.message ?? hpError);
        return NextResponse.json(
          { error: `Error al guardar datos de salud: ${hpError.message}` },
          { status: 500 },
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated } = await (svc as any)
      .from("patients")
      .select("id, full_name, email, phone")
      .eq("id", patientRow.id)
      .maybeSingle() as {
        data: { id: string; full_name: string | null; email: string | null; phone: string | null } | null;
        error: unknown;
      };

    return NextResponse.json({
      id: updated?.id,
      fullName: updated?.full_name,
      email: updated?.email,
      phone: updated?.phone,
    });
  }

  return NextResponse.json({ error: "No autorizado" }, { status: 403 });
}
