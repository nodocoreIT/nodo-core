import { NextRequest, NextResponse } from "next/server";
import { requireAuth, resolveProfessional } from "@/lib/supabase/auth-guard";
import {
  createPrescription,
  createRecord,
  getPrescriptionsByDoctor,
} from "@/lib/clinic/db/clinical-records";
import { getInstitutionById } from "@/lib/clinic/db/institutions";
import { formatPrescriptionRecordContent } from "@/lib/clinic/medication-catalog";

/**
 * Fase 5 of "Recetas" — the médico's recetas history (draft/sent/paid), used
 * by <RecetasList /> in the médico dashboard. `doctorId` query param is
 * accepted for symmetry with other endpoints (e.g. GET /appointments) but is
 * only ever honored when it matches the authenticated médico — a médico can
 * never list another médico's recetas.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  if (user.role !== "doctor" && user.role !== "medico") {
    return NextResponse.json(
      { error: "Debe iniciar sesión como médico" },
      { status: 401 },
    );
  }

  const professional = await resolveProfessional(authResult);
  if (!professional?.id) {
    return NextResponse.json({ error: "Médico no encontrado" }, { status: 404 });
  }

  if (!user.org_id) {
    return NextResponse.json({ error: "org_id requerido" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const doctorIdParam = searchParams.get("doctorId");
  if (doctorIdParam && doctorIdParam !== professional.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data, error } = await getPrescriptionsByDoctor(
    supabase,
    professional.id,
    user.org_id,
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prescriptions = (data ?? []).map((row: any) => ({
    id: row.id,
    patientFullName: row.patient_full_name ?? row.patients?.full_name ?? "Paciente",
    institutionSnapshot: row.institution_snapshot ?? null,
    priceAmount: row.price_amount,
    priceCurrency: row.price_currency,
    paymentStatus: row.payment_status,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  }));

  return NextResponse.json({ prescriptions });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  try {
    const {
      appointmentId,
      doctorId,
      patientId,
      medications,
      pdfBase64,
      institutionId,
      priceAmount,
      notes,
      patientEmail,
      patientFullName,
    } = await request.json();

    // Fase 2 — standalone recetas: patientId (paciente registrado) OR
    // patientEmail+patientFullName (paciente no registrado) is required, not
    // both. The live-consultation call site always sends patientId, so its
    // behavior is unchanged.
    const hasRegisteredPatient = Boolean(patientId);
    const hasUnregisteredPatient = Boolean(patientEmail) && Boolean(patientFullName);

    if (
      !doctorId ||
      !Array.isArray(medications) ||
      medications.length === 0 ||
      (!hasRegisteredPatient && !hasUnregisteredPatient)
    ) {
      return NextResponse.json(
        {
          error:
            "doctorId, medications y (patientId o patientEmail+patientFullName) son requeridos",
        },
        { status: 400 },
      );
    }

    if (!user.org_id) {
      return NextResponse.json({ error: "org_id requerido" }, { status: 403 });
    }

    const [{ data: patient }, { data: professional }] = await Promise.all([
      patientId
        ? supabase
            .from("patients")
            .select("id, full_name")
            .eq("id", patientId)
            .eq("org_id", user.org_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("professionals")
        .select("id, full_name")
        .eq("id", doctorId)
        .eq("org_id", user.org_id)
        .maybeSingle(),
    ]);

    if (!professional || (patientId && !patient)) {
      return NextResponse.json(
        { error: "Paciente o médico no encontrado" },
        { status: 404 },
      );
    }

    // Snapshot the institution's letterhead fields at issue time — a later
    // edit to the institution (Fase 1) must not rewrite this receta's PDF.
    let institutionSnapshot: {
      name: string;
      city: string | null;
      address: string | null;
      extraInfo: string | null;
    } | null = null;
    if (institutionId) {
      const { data: institution } = await getInstitutionById(
        supabase,
        institutionId,
        user.org_id,
      );
      if (institution) {
        institutionSnapshot = {
          name: institution.name,
          city: institution.city,
          address: institution.address,
          extraInfo: institution.extra_info,
        };
      }
    }

    // Create prescription record
    const { data: prescription, error: prescError } = await createPrescription(
      supabase,
      {
        org_id: user.org_id,
        appointment_id: appointmentId || null,
        doctor_id: doctorId,
        patient_id: patientId || null,
        medications,
        pdf_url: null,
        institution_id: institutionId || null,
        institution_snapshot: institutionSnapshot,
        price_amount: typeof priceAmount === "number" ? priceAmount : null,
        patient_email: patientEmail || null,
        patient_full_name: patientFullName || null,
        notes: notes || null,
      },
    );

    if (prescError || !prescription) {
      return NextResponse.json(
        { error: prescError?.message ?? "Error al crear receta" },
        { status: 500 },
      );
    }

    // Mirror into clinical_records only for registered patients — an
    // unregistered patient (no patientId) has no clinical_records row to
    // attach to.
    let record: { id: string } | null = null;
    if (patientId) {
      const content = formatPrescriptionRecordContent(medications);
      const patientLabel = patient?.full_name ?? patientFullName ?? "Paciente";
      const { data: createdRecord } = await createRecord(supabase, {
        org_id: user.org_id,
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_id: appointmentId || null,
        title: `Receta — ${patientLabel} — ${new Date().toLocaleDateString("es-AR")}`,
        content,
        record_type: "receta",
      });
      record = createdRecord;
    }

    void pdfBase64; // PDF storage handled separately via documents route

    return NextResponse.json({
      id: prescription.id,
      appointment_id: appointmentId,
      medications,
      clinical_record_id: record?.id,
      downloadUrl: record ? `/api/clinic/clinical-records/pdf?id=${record.id}` : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
