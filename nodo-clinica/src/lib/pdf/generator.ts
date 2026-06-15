import { jsPDF } from "jspdf";
import type { Medication, Profile } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PrescriptionPdfOptions {
  doctor: Pick<Profile, "full_name" | "specialty" | "license_number">;
  patientName: string;
  medications: Medication[];
  logoUrl?: string;
  signatureUrl?: string;
}

export function generatePrescriptionPdf(options: PrescriptionPdfOptions): jsPDF {
  const doc = new jsPDF();
  const { doctor, patientName, medications } = options;

  doc.setFillColor(240, 247, 255);
  doc.rect(0, 0, 210, 40, "F");

  doc.setFontSize(18);
  doc.setTextColor(30, 64, 110);
  doc.text("Receta Médica Digital", 105, 15, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Dr/a. ${doctor.full_name}`, 105, 24, { align: "center" });
  if (doctor.specialty) {
    doc.text(doctor.specialty, 105, 30, { align: "center" });
  }
  if (doctor.license_number) {
    doc.text(`Mat. Prof. ${doctor.license_number}`, 105, 36, { align: "center" });
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(20, 45, 190, 45);

  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`Paciente: ${patientName}`, 20, 55);
  doc.text(
    `Fecha: ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}`,
    20,
    63
  );

  doc.setFontSize(12);
  doc.setTextColor(30, 64, 110);
  doc.text("Medicamentos:", 20, 78);

  let y = 88;
  medications.forEach((med, index) => {
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`${index + 1}. ${med.name}`, 25, y);
    y += 7;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`   Dosis: ${med.dosage} | Frecuencia: ${med.frequency} | Duración: ${med.duration}`, 25, y);
    y += 6;
    if (med.instructions) {
      doc.text(`   Indicaciones: ${med.instructions}`, 25, y);
      y += 6;
    }
    y += 4;
  });

  doc.setDrawColor(203, 213, 225);
  doc.line(20, 240, 190, 240);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("Firma digital del profesional:", 20, 252);
  doc.setFontSize(11);
  doc.setTextColor(30, 64, 110);
  doc.text(`Dr/a. ${doctor.full_name}`, 20, 260);
  if (doctor.license_number) {
    doc.text(`Mat. ${doctor.license_number}`, 20, 267);
  }

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Documento generado electrónicamente — Clínica Virtual",
    105,
    285,
    { align: "center" }
  );

  return doc;
}

interface StudyOrderPdfOptions {
  doctor: Pick<Profile, "full_name" | "specialty" | "license_number">;
  patientName: string;
  studies: string[];
  notes?: string;
}

export function generateStudyOrderPdf(options: StudyOrderPdfOptions): jsPDF {
  const doc = new jsPDF();
  const { doctor, patientName, studies, notes } = options;

  doc.setFillColor(240, 247, 255);
  doc.rect(0, 0, 210, 40, "F");

  doc.setFontSize(18);
  doc.setTextColor(30, 64, 110);
  doc.text("Orden de Estudios Médicos", 105, 15, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Dr/a. ${doctor.full_name}`, 105, 24, { align: "center" });
  if (doctor.specialty) doc.text(doctor.specialty, 105, 30, { align: "center" });
  if (doctor.license_number) {
    doc.text(`Mat. Prof. ${doctor.license_number}`, 105, 36, { align: "center" });
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(20, 45, 190, 45);

  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`Paciente: ${patientName}`, 20, 55);
  doc.text(
    `Fecha: ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}`,
    20,
    63
  );

  doc.setFontSize(12);
  doc.setTextColor(30, 64, 110);
  doc.text("Estudios solicitados:", 20, 78);

  let y = 88;
  studies.forEach((study, index) => {
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`${index + 1}. ${study}`, 25, y);
    y += 10;
  });

  if (notes) {
    y += 10;
    doc.setFontSize(11);
    doc.setTextColor(30, 64, 110);
    doc.text("Observaciones:", 20, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(notes, 170);
    doc.text(lines, 20, y);
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(20, 240, 190, 240);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("Firma del profesional solicitante:", 20, 252);
  doc.setFontSize(11);
  doc.setTextColor(30, 64, 110);
  doc.text(`Dr/a. ${doctor.full_name}`, 20, 260);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Documento generado electrónicamente — Clínica Virtual",
    105,
    285,
    { align: "center" }
  );

  return doc;
}

export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export function pdfToBase64(doc: jsPDF): string {
  return doc.output("datauristring").split(",")[1];
}

export function pdfToBlob(doc: jsPDF): Blob {
  return doc.output("blob");
}
