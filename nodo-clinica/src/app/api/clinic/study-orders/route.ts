import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createStudyOrder, createRecord } from "@/lib/clinic/db/clinical-records";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  try {
    const {
      appointmentId,
      doctorId,
      patientId,
      studies,
      notes,
      pdfBase64,
      newStudyLabels,
    } = await request.json();

    if (
      !doctorId ||
      !patientId ||
      !Array.isArray(studies) ||
      studies.length === 0
    ) {
      return NextResponse.json(
        { error: "doctorId, patientId y studies requeridos" },
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
        .select("id, full_name, office_settings(*)")
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

    const { data: studyOrder, error: orderError } = await createStudyOrder(
      supabase,
      {
        org_id: user.org_id,
        appointment_id: appointmentId,
        doctor_id: doctorId,
        patient_id: patientId,
        studies,
        notes: notes?.trim() || null,
        pdf_url: null,
      },
    );

    if (orderError || !studyOrder) {
      return NextResponse.json(
        { error: orderError?.message ?? "Error al crear orden" },
        { status: 500 },
      );
    }

    // Build clinical record content for PDF generation
    const studyList = studies
      .map((s: string, i: number) => `${i + 1}. ${s}`)
      .join("\n");
    const content = [
      "Estudios solicitados:",
      studyList,
      notes?.trim() ? `\nObservaciones:\n${notes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { data: record } = await createRecord(supabase, {
      org_id: user.org_id,
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_id: appointmentId || null,
      title: `Orden de estudios — ${patient.full_name} — ${new Date().toLocaleDateString("es-AR")}`,
      content,
      record_type: "estudio",
    });

    // Persist new custom study labels to office_settings
    if (
      Array.isArray(newStudyLabels) &&
      newStudyLabels.length > 0
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const officeSettings = (professional as any).office_settings;
      const existing: string[] = officeSettings?.custom_study_labels ?? [];
      const merged = [...new Set([...existing, ...newStudyLabels.map(String).map((s) => s.trim()).filter(Boolean)])];
      await supabase
        .from("office_settings")
        .update({ custom_study_labels: merged })
        .eq("professional_id", professional.id);
    }

    void pdfBase64; // PDF storage handled separately via documents route

    return NextResponse.json({
      id: studyOrder.id,
      appointment_id: appointmentId,
      studies,
      notes,
      clinical_record_id: record?.id,
      downloadUrl: record ? `/api/clinic/clinical-records/pdf?id=${record.id}` : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
