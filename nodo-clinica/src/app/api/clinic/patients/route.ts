// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import {
  getPatients,
  getPatientById,
  updatePatient,
  upsertHealthProfile,
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
  const { profilePhotoUrl, healthProfile } = body as {
    profilePhotoUrl?: string;
    healthProfile?: {
      blood_type?: string | null;
      allergies?: string[] | null;
      chronic_conditions?: string[] | null;
      insurance_provider?: string | null;
      insurance_number?: string | null;
    };
  };

  // Patients update their own profile; doctors can update any patient in org
  if (user.role === "patient") {
    // Find the patient row linked to the auth user
    const { data: patientRow } = await supabase
      .from("patients")
      .select("id, org_id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!patientRow) {
      return NextResponse.json(
        { error: "Paciente no encontrado" },
        { status: 404 },
      );
    }

    if (profilePhotoUrl !== undefined) {
      await updatePatient(supabase, patientRow.id, patientRow.org_id, {
        profile_photo_url: profilePhotoUrl,
      });
    }

    if (healthProfile !== undefined) {
      await upsertHealthProfile(supabase, {
        patient_id: patientRow.id,
        ...healthProfile,
      });
    }

    const { data: updated } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patientRow.id)
      .maybeSingle();

    return NextResponse.json({
      id: updated?.id,
      fullName: updated?.full_name,
      email: updated?.email,
      phone: updated?.phone,
    });
  }

  return NextResponse.json({ error: "No autorizado" }, { status: 403 });
}
