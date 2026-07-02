import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import {
  generateClinicalReportPdf,
  generatePrescriptionPdf,
  generateStudyOrderPdf,
} from "@/lib/pdf/generator";
import { parsePrescriptionRecordContent } from "@/lib/clinic/medication-catalog";

export const dynamic = "force-dynamic";

/** Regenerates or serves PDF of prescription / study order / clinical report. */
export async function GET(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  const { data: record, error } = await supabase
    .from("clinical_records")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !record) {
    return NextResponse.json(
      { error: "Registro no encontrado" },
      { status: 404 },
    );
  }

  // Patient access: only own records
  if (user.role === "patient") {
    const { data: patientRow } = await supabase
      .from("patients")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!patientRow || patientRow.id !== record.patient_id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const [{ data: patient }, { data: professional }] = await Promise.all([
    supabase.from("patients").select("*").eq("id", record.patient_id).maybeSingle(),
    supabase.from("professionals").select("*, office_settings(*)").eq("id", record.doctor_id).maybeSingle(),
  ]);

  if (!patient || !professional) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const officeSettings = (professional as any).office_settings;
  const doctorProfile = {
    full_name: professional.full_name,
    specialty: professional.specialty ?? "",
    license_number: professional.license_number ?? "",
  };

  let pdfDoc;
  let fileName = "documento-clinico.pdf";

  if (record.record_type === "receta") {
    const medications = parsePrescriptionRecordContent(record.content);
    if (!medications.length) {
      return NextResponse.json(
        { error: "No se pudo reconstruir la receta" },
        { status: 422 },
      );
    }
    pdfDoc = generatePrescriptionPdf({
      doctor: doctorProfile,
      patientName: patient.full_name,
      medications,
      signatureText:
        officeSettings?.signature_text || `Dr/a. ${professional.full_name}`,
      signatureImageData: officeSettings?.signature_image_data,
    });
    fileName = `receta-${patient.full_name.replace(/\s+/g, "-")}.pdf`;
  } else if (record.record_type === "estudio") {
    const studyLines = record.content
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => /^\d+\.\s/.test(line))
      .map((line: string) => line.replace(/^\d+\.\s*/, "").trim());
    const notesMatch = record.content.match(/Observaciones:\n([\s\S]*)$/);
    pdfDoc = generateStudyOrderPdf({
      doctor: doctorProfile,
      patientName: patient.full_name,
      studies: studyLines.length ? studyLines : [record.content.slice(0, 200)],
      notes: notesMatch?.[1]?.trim(),
      signatureText:
        officeSettings?.signature_text || `Dr/a. ${professional.full_name}`,
      signatureImageData: officeSettings?.signature_image_data,
    });
    fileName = `orden-estudios-${patient.full_name.replace(/\s+/g, "-")}.pdf`;
  } else if (record.record_type === "informe") {
    pdfDoc = generateClinicalReportPdf({
      doctor: doctorProfile,
      patientName: patient.full_name,
      reportMarkdown: record.content,
      signatureText:
        officeSettings?.signature_text || `Dr/a. ${professional.full_name}`,
      signatureImageData: officeSettings?.signature_image_data,
    });
    fileName = `informe-${patient.full_name.replace(/\s+/g, "-")}.pdf`;
  } else {
    return NextResponse.json(
      { error: "Tipo de documento sin PDF" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(pdfDoc.output("arraybuffer"));
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
    },
  });
}
