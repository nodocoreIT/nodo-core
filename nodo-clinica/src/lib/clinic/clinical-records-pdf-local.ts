import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/clinic/local-db";
import {
  generateClinicalReportPdf,
  generatePrescriptionPdf,
  generateStudyOrderPdf,
} from "@/lib/pdf/generator";
import { parsePrescriptionRecordContent } from "@/lib/clinic/medication-catalog";

async function resolveAppointmentByToken(token: string) {
  const db = await readDb();
  return db.appointments.find((a) => a.accessToken === token) ?? null;
}

/** GET /api/clinic/clinical-records/pdf en CLINIC_MODE=local */
export async function handleClinicalRecordPdfGetLocal(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const accessToken = searchParams.get("token");

  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  const db = await readDb();
  const record = db.clinicalRecords.find((r) => r.id === id);
  if (!record) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  if (accessToken) {
    const apt = await resolveAppointmentByToken(accessToken);
    if (!apt || record.appointmentId !== apt.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  if (record.documentId) {
    const doc = db.documents.find((d) => d.id === record.documentId);
    if (doc?.inlineDataBase64) {
      const buffer = Buffer.from(doc.inlineDataBase64, "base64");
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": doc.mimeType || "application/pdf",
          "Content-Disposition": `inline; filename="${doc.fileName}"`,
        },
      });
    }
  }

  const patient = db.patients.find((p) => p.id === record.patientId);
  const doctor = db.doctors.find((d) => d.id === record.doctorId);
  if (!patient || !doctor) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 404 });
  }

  const doctorProfile = {
    full_name: doctor.fullName,
    specialty: doctor.specialty ?? "",
    license_number: doctor.licenseNumber ?? "",
  };

  let pdfDoc;
  let fileName = "documento-clinico.pdf";

  if (record.recordType === "receta") {
    const medications = parsePrescriptionRecordContent(record.content);
    if (!medications.length) {
      return NextResponse.json(
        { error: "No se pudo reconstruir la receta" },
        { status: 422 },
      );
    }
    pdfDoc = generatePrescriptionPdf({
      doctor: doctorProfile,
      patientName: patient.fullName,
      medications,
      signatureText: doctor.signatureText || `Dr/a. ${doctor.fullName}`,
      signatureImageData: doctor.signatureImageData,
    });
    fileName = `receta-${patient.fullName.replace(/\s+/g, "-")}.pdf`;
  } else if (record.recordType === "estudio") {
    const studyLines = record.content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+\.\s/.test(line))
      .map((line) => line.replace(/^\d+\.\s*/, "").trim());
    const notesMatch = record.content.match(/Observaciones:\n([\s\S]*)$/);
    pdfDoc = generateStudyOrderPdf({
      doctor: doctorProfile,
      patientName: patient.fullName,
      studies: studyLines.length ? studyLines : [record.content.slice(0, 200)],
      notes: notesMatch?.[1]?.trim(),
      signatureText: doctor.signatureText || `Dr/a. ${doctor.fullName}`,
      signatureImageData: doctor.signatureImageData,
    });
    fileName = `orden-estudios-${patient.fullName.replace(/\s+/g, "-")}.pdf`;
  } else if (record.recordType === "informe") {
    pdfDoc = generateClinicalReportPdf({
      doctor: doctorProfile,
      patientName: patient.fullName,
      reportMarkdown: record.content,
      signatureText: doctor.signatureText || `Dr/a. ${doctor.fullName}`,
      signatureImageData: doctor.signatureImageData,
    });
    fileName = `informe-${patient.fullName.replace(/\s+/g, "-")}.pdf`;
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
