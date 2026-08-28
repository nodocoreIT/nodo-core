import { jsPDF } from "jspdf";
import type { Medication, Profile } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Firma + nombre + matrícula, todos centrados sobre un mismo eje vertical
 * ubicado hacia la derecha del documento (no en el margen izquierdo).
 */
function drawSignatureBlock(
  doc: jsPDF,
  opts: {
    signatureText?: string;
    signatureImageData?: string;
    doctorFullName: string;
    licenseNumber?: string;
    y: number;
  },
) {
  const { signatureText, signatureImageData, doctorFullName, licenseNumber, y } = opts;
  const axisX = 160; // centro del bloque — 30mm del margen derecho (190)
  const imageWidth = 40;
  const imageHeight = 18;

  let sigY = y + 6;

  if (signatureImageData?.startsWith("data:image")) {
    try {
      doc.addImage(signatureImageData, "PNG", axisX - imageWidth / 2, y, imageWidth, imageHeight);
      sigY = y + imageHeight + 4;
    } catch {
      /* ignore invalid image */
    }
  }

  doc.setFontSize(11);
  doc.setTextColor(30, 64, 110);
  doc.text(signatureText || `Dr/a. ${doctorFullName}`, axisX, sigY, { align: "center" });
  if (licenseNumber) {
    doc.text(`Mat. ${licenseNumber}`, axisX, sigY + 7, { align: "center" });
  }
}

interface PrescriptionPdfOptions {
  doctor: Pick<Profile, "full_name" | "specialty" | "license_number">;
  patientName: string;
  medications: Medication[];
  logoUrl?: string;
  signatureUrl?: string;
  signatureText?: string;
  signatureImageData?: string;
  /** Fase 2 — standalone (fuera de consulta) prescriptions: when present,
   * renders a gray institution letterhead instead of the default teal
   * consultation header. The live consultation call site never passes this,
   * so its visual output is unchanged. */
  institution?: { name: string; city?: string; address?: string; extraInfo?: string };
  patientDni?: string;
  notes?: string;
  /** Fecha a imprimir en el documento. Para recetas standalone (Fase 3+),
   * debe ser la fecha del último envío/reenvío (prescriptions.sent_at) — no
   * el momento en que el paciente descarga el PDF ya pagado, que puede ser
   * días después. Si no se pasa, usa el momento de generación (comportamiento
   * histórico, correcto para la receta de consulta en vivo). */
  issuedAt?: Date;
}

export function generatePrescriptionPdf(options: PrescriptionPdfOptions): jsPDF {
  const doc = new jsPDF();
  const {
    doctor,
    patientName,
    medications,
    signatureText,
    signatureImageData,
    institution,
    patientDni,
    notes,
    issuedAt,
  } = options;
  const dateLabel = format(issuedAt ?? new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

  if (institution) {
    // Standalone flow: gray institution letterhead instead of the teal
    // consultation header — membrete for the institution the receta was
    // issued under, snapshotted at issue time.
    doc.setFillColor(226, 232, 240);
    doc.rect(0, 0, 210, 34, "F");

    doc.setFontSize(16);
    doc.setTextColor(51, 65, 85);
    doc.text(institution.name, 105, 14, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    let headerY = 21;
    const locationLine = [institution.city, institution.address]
      .filter(Boolean)
      .join(" — ");
    if (locationLine) {
      doc.text(locationLine, 105, headerY, { align: "center" });
      headerY += 6;
    }
    if (institution.extraInfo) {
      doc.text(institution.extraInfo, 105, headerY, { align: "center" });
    }

    doc.setDrawColor(148, 163, 184);
    doc.line(20, 40, 190, 40);

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`APELLIDO Y NOMBRE: ${patientName}`, 20, 50);
    doc.text(`DNI: ${patientDni || "-"}`, 20, 58);
  } else {
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
    doc.text(`Fecha: ${dateLabel}`, 20, 63);
  }

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

  if (notes) {
    y += 4;
    doc.setFontSize(11);
    doc.setTextColor(30, 64, 110);
    doc.text("Indicaciones:", 20, y);
    y += 7;
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const noteLines = doc.splitTextToSize(notes, 170);
    doc.text(noteLines, 20, y);
    y += noteLines.length * 5;
  }

  if (institution) {
    // "fecha al pie" — placed near the bottom instead of near the top,
    // since the letterhead above already carries institution + patient info.
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Fecha: ${dateLabel}`, 20, 234);
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(20, 240, 190, 240);

  drawSignatureBlock(doc, {
    signatureText,
    signatureImageData,
    doctorFullName: doctor.full_name,
    licenseNumber: doctor.license_number ?? undefined,
    y: 250,
  });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Documento generado electrónicamente — NODO | Clínica",
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
  signatureText?: string;
  signatureImageData?: string;
}

export function generateStudyOrderPdf(options: StudyOrderPdfOptions): jsPDF {
  const doc = new jsPDF();
  const {
    doctor,
    patientName,
    studies,
    notes,
    signatureText,
    signatureImageData,
  } = options;

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

  drawSignatureBlock(doc, {
    signatureText,
    signatureImageData,
    doctorFullName: doctor.full_name,
    licenseNumber: doctor.license_number ?? undefined,
    y: 250,
  });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Documento generado electrónicamente — NODO | Clínica",
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

interface ClinicalReportPdfOptions {
  doctor: Pick<Profile, "full_name" | "specialty" | "license_number">;
  patientName: string;
  reportMarkdown: string;
  signatureText?: string;
  signatureImageData?: string;
}

/** Bullet "- Etiqueta: detalle" → guion + etiqueta en negrita real + detalle normal. */
function renderBulletLine(
  doc: jsPDF,
  line: string,
  x: number,
  y: number,
  maxWidth: number,
): number {
  const match = line.match(/^-\s+([A-ZÁÉÍÓÚÑ][^:\d]{1,40}):\s+(.+)$/);
  if (!match) {
    const wrapped = doc.splitTextToSize(line, maxWidth);
    doc.text(wrapped, x, y);
    return y + wrapped.length * 5 + 2;
  }

  const [, label, rest] = match;
  const prefix = "- ";
  const boldLabel = `${label}:`;

  doc.setFont("helvetica", "normal");
  const prefixWidth = doc.getTextWidth(prefix);
  doc.setFont("helvetica", "bold");
  const labelWidth = doc.getTextWidth(boldLabel);
  doc.setFont("helvetica", "normal");
  const restLead = ` ${rest}`;
  const restLeadWidth = doc.getTextWidth(restLead);

  if (prefixWidth + labelWidth + restLeadWidth <= maxWidth) {
    doc.text(prefix, x, y);
    doc.setFont("helvetica", "bold");
    doc.text(boldLabel, x + prefixWidth, y);
    doc.setFont("helvetica", "normal");
    doc.text(restLead, x + prefixWidth + labelWidth, y);
    return y + 5 + 2;
  }

  doc.text(prefix, x, y);
  doc.setFont("helvetica", "bold");
  doc.text(boldLabel, x + prefixWidth, y);
  doc.setFont("helvetica", "normal");
  const wrapped = doc.splitTextToSize(rest, maxWidth - 4);
  doc.text(wrapped, x + 4, y + 5);
  return y + 5 + wrapped.length * 5 + 2;
}

/** Convierte markdown simple (## títulos, viñetas "- Etiqueta: detalle") a líneas PDF. */
function markdownToPdfLines(doc: jsPDF, text: string, x: number, startY: number, maxWidth: number) {
  let y = startY;
  const lines = text.split("\n");
  for (const line of lines) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }
    const trimmed = line.trim();
    if (!trimmed) {
      y += 4;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 64, 110);
      doc.text(trimmed.slice(3), x, y);
      doc.setFont("helvetica", "normal");
      y += 8;
      continue;
    }
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    y = renderBulletLine(doc, trimmed, x, y, maxWidth);
  }
  return y;
}

export function generateClinicalReportPdf(
  options: ClinicalReportPdfOptions,
): jsPDF {
  const doc = new jsPDF();
  const {
    doctor,
    patientName,
    reportMarkdown,
    signatureText,
    signatureImageData,
  } = options;

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 42, "F");

  doc.setFontSize(18);
  doc.setTextColor(30, 64, 110);
  doc.text("Informe Médico", 105, 16, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Dr/a. ${doctor.full_name}`, 105, 25, { align: "center" });
  if (doctor.specialty) doc.text(doctor.specialty, 105, 31, { align: "center" });
  if (doctor.license_number) {
    doc.text(`Mat. Prof. ${doctor.license_number}`, 105, 37, { align: "center" });
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(20, 46, 190, 46);

  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`Paciente: ${patientName}`, 20, 56);
  doc.text(
    `Fecha: ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}`,
    20,
    64,
  );

  markdownToPdfLines(doc, reportMarkdown, 20, 76, 170);

  doc.setDrawColor(203, 213, 225);
  doc.line(20, 240, 190, 240);

  drawSignatureBlock(doc, {
    signatureText,
    signatureImageData,
    doctorFullName: doctor.full_name,
    licenseNumber: doctor.license_number ?? undefined,
    y: 250,
  });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Documento generado electrónicamente — NODO | Clínica",
    105,
    285,
    { align: "center" },
  );

  return doc;
}
