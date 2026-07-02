import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createPrescription } from "@/lib/clinic/db/clinical-records";
import { formatPrescriptionRecordContent } from "@/lib/clinic/medication-catalog";
import { createRecord } from "@/lib/clinic/db/clinical-records";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  try {
    const { appointmentId, doctorId, patientId, medications, pdfBase64 } =
      await request.json();

    if (
      !doctorId ||
      !patientId ||
      !Array.isArray(medications) ||
      medications.length === 0
    ) {
      return NextResponse.json(
        { error: "doctorId, patientId y medications requeridos" },
        { status: 400 },
      );
    }

    if (!user.org_id) {
      return NextResponse.json({ error: "org_id requerido" }, { status: 403 });
    }

    const [{ data: patient }, { data: professional }] = await Promise.all([
      supabase
        .from("patients")
        .select("id, full_name")
        .eq("id", patientId)
        .eq("org_id", user.org_id)
        .maybeSingle(),
      supabase
        .from("professionals")
        .select("id, full_name")
        .eq("id", doctorId)
        .eq("org_id", user.org_id)
        .maybeSingle(),
    ]);

    if (!patient || !professional) {
      return NextResponse.json(
        { error: "Paciente o médico no encontrado" },
        { status: 404 },
      );
    }

    // Create prescription record
    const { data: prescription, error: prescError } = await createPrescription(
      supabase,
      {
        org_id: user.org_id,
        appointment_id: appointmentId,
        doctor_id: doctorId,
        patient_id: patientId,
        medications,
        pdf_url: null,
      },
    );

    if (prescError || !prescription) {
      return NextResponse.json(
        { error: prescError?.message ?? "Error al crear receta" },
        { status: 500 },
      );
    }

    // Also create a clinical record entry for the prescription
    const content = formatPrescriptionRecordContent(medications);
    const { data: record } = await createRecord(supabase, {
      org_id: user.org_id,
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_id: appointmentId || null,
      title: `Receta — ${patient.full_name} — ${new Date().toLocaleDateString("es-AR")}`,
      content,
      record_type: "receta",
    });

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
