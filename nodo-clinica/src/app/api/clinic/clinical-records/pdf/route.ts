import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/auth-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { isLocalMode } from "@/lib/clinic/config";
import { resolveAppointmentByAccessToken } from "@/lib/clinic/appointment-token-auth";
import { handleClinicalRecordPdfGetLocal } from "@/lib/clinic/clinical-records-pdf-local";
import {
  generateClinicalReportPdf,
  generatePrescriptionPdf,
  generateStudyOrderPdf,
} from "@/lib/pdf/generator";
import { parsePrescriptionRecordContent } from "@/lib/clinic/medication-catalog";
import { isPrescriptionExpired } from "@/lib/clinic/prescription-expiration";

export const dynamic = "force-dynamic";

type ClinicalRecordRow = {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id?: string | null;
  record_type: string;
  title: string;
  content: string;
};

type ProfessionalRow = {
  full_name: string;
  specialty?: string | null;
  license_number?: string | null;
  signature_text?: string | null;
  signature_image_url?: string | null;
};

async function renderClinicalRecordPdf(
  record: ClinicalRecordRow,
  patient: { full_name: string },
  professional: ProfessionalRow,
) {
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
        professional.signature_text || `Dr/a. ${professional.full_name}`,
      signatureImageData: professional.signature_image_url ?? undefined,
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
        professional.signature_text || `Dr/a. ${professional.full_name}`,
      signatureImageData: professional.signature_image_url ?? undefined,
    });
    fileName = `orden-estudios-${patient.full_name.replace(/\s+/g, "-")}.pdf`;
  } else if (record.record_type === "informe") {
    pdfDoc = generateClinicalReportPdf({
      doctor: doctorProfile,
      patientName: patient.full_name,
      reportMarkdown: record.content,
      signatureText:
        professional.signature_text || `Dr/a. ${professional.full_name}`,
      signatureImageData: professional.signature_image_url ?? undefined,
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

/** Regenerates or serves PDF of prescription / study order / clinical report. */
export async function GET(request: NextRequest) {
  if (isLocalMode()) {
    return handleClinicalRecordPdfGetLocal(request);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const accessToken = searchParams.get("token");

  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  if (accessToken) {
    const apt = await resolveAppointmentByAccessToken(accessToken);
    if (!apt) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const svc = await createServiceClient();
    const { data: record, error } = await svc
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

    if (record.appointment_id !== apt.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const [{ data: patient }, { data: professionalRow }] = await Promise.all([
      svc.from("patients").select("*").eq("id", record.patient_id).maybeSingle(),
      svc
        .from("professionals")
        .select("*")
        .eq("id", record.doctor_id)
        .maybeSingle(),
    ]);

    if (!patient || !professionalRow) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 404 });
    }

    return renderClinicalRecordPdf(
      record as ClinicalRecordRow,
      patient,
      professionalRow as ProfessionalRow,
    );
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

  if (user.role === "patient") {
    const { data: patientRow } = await supabase
      .from("patients")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!patientRow || patientRow.id !== record.patient_id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // "Mis recetas" 10-day access window (patient portal only — a médico
    // reviewing their own history, or the appointment-accessToken branch
    // above, is unaffected). Only applies to record_type "receta"; estudios
    // and informes have no expiration rule.
    if (record.record_type === "receta" && isPrescriptionExpired(record.created_at)) {
      return NextResponse.json({ error: "Esta receta ya venció" }, { status: 404 });
    }
  }

  const [{ data: patient }, { data: professionalRow }] = await Promise.all([
    supabase.from("patients").select("*").eq("id", record.patient_id).maybeSingle(),
    supabase.from("professionals").select("*").eq("id", record.doctor_id).maybeSingle(),
  ]);

  if (!patient || !professionalRow) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 404 });
  }

  return renderClinicalRecordPdf(
    record as ClinicalRecordRow,
    patient,
    professionalRow as ProfessionalRow,
  );
}
