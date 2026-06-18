import { jsPDF } from "jspdf";
import type { LocalPresupuesto } from "@/lib/obra/types";
import { totalPresupuesto } from "@/lib/obra/presupuestos";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export interface PresupuestoPdfInput {
  presupuesto: LocalPresupuesto;
  clienteNombre: string;
  encargadoNombre?: string;
}

export function generatePresupuestoPdf(input: PresupuestoPdfInput): jsPDF {
  const { presupuesto, clienteNombre, encargadoNombre } = input;
  const doc = new jsPDF();
  const { subtotal, contingencia, total } = totalPresupuesto(
    presupuesto.rubros,
    presupuesto.porcentajeContingencia,
  );

  doc.setFillColor(0, 48, 0);
  doc.rect(0, 0, 210, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text("nodoobra", 20, 18);
  doc.setFontSize(11);
  doc.text("Presupuesto de obra", 20, 28);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.text(presupuesto.titulo, 20, 50);

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  let y = 60;
  const lines: [string, string][] = [
    ["Cliente", clienteNombre],
    ["Dirección", presupuesto.direccionObra || "—"],
    ["Inmueble", presupuesto.tipoInmueble],
    ["Plazo estimado", `${presupuesto.plazoMeses} mes(es)`],
    ["Encargado", encargadoNombre || presupuesto.encargado || "—"],
    ["Fecha", formatDate(presupuesto.updatedAt)],
  ];
  if (presupuesto.inmoPropertyLabel) {
    lines.splice(2, 0, ["Propiedad nodo-inmo", presupuesto.inmoPropertyLabel]);
  }

  for (const [label, value] of lines) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 20, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 55, y);
    y += 7;
  }

  y += 6;
  doc.setDrawColor(203, 213, 225);
  doc.line(20, y, 190, y);
  y += 10;

  doc.setFontSize(11);
  doc.setTextColor(0, 48, 0);
  doc.setFont("helvetica", "bold");
  doc.text("Detalle por rubro", 20, y);
  y += 8;

  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text("Rubro", 20, y);
  doc.text("M.O.", 100, y);
  doc.text("Materiales", 130, y);
  doc.text("Subtotal", 170, y);
  y += 5;
  doc.line(20, y, 190, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  for (const rubro of presupuesto.rubros) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    const lineTotal = rubro.manoObra + rubro.materiales;
    doc.text(rubro.rubroNombre.slice(0, 28), 20, y);
    doc.text(formatMoney(rubro.manoObra), 100, y);
    doc.text(formatMoney(rubro.materiales), 130, y);
    doc.text(formatMoney(lineTotal), 170, y);
    y += 6;
    if (rubro.notas) {
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text(`  ${rubro.notas.slice(0, 80)}`, 22, y);
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      y += 5;
    }
  }

  y += 8;
  doc.line(120, y, 190, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Subtotal:", 120, y);
  doc.text(formatMoney(subtotal), 170, y);
  y += 7;
  doc.text(`Contingencia (${presupuesto.porcentajeContingencia}%):`, 120, y);
  doc.text(formatMoney(contingencia), 170, y);
  y += 9;
  doc.setFontSize(12);
  doc.setTextColor(0, 48, 0);
  doc.text("TOTAL:", 120, y);
  doc.text(formatMoney(total), 170, y);

  if (presupuesto.notas) {
    y += 14;
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "bold");
    doc.text("Observaciones", 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const notasLines = doc.splitTextToSize(presupuesto.notas, 170);
    doc.text(notasLines, 20, y);
  }

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "Documento generado por nodo-obra · Válido como referencia comercial",
    105,
    285,
    { align: "center" },
  );

  return doc;
}

export function presupuestoPdfBuffer(input: PresupuestoPdfInput): Buffer {
  const doc = generatePresupuestoPdf(input);
  return Buffer.from(doc.output("arraybuffer"));
}
