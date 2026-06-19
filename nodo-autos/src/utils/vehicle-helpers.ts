import QRCode from "qrcode";
import jsPDF from "jspdf";
import type { Vehicle } from "@/types";

export function buildPublicVehicleUrl(publicSlug: string, clienteIdentificador?: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  if (clienteIdentificador?.trim()) {
    return `${base}/autos/${encodeURIComponent(clienteIdentificador.trim())}/${encodeURIComponent(publicSlug)}`;
  }
  return `${base}/autos/x/${encodeURIComponent(publicSlug)}`;
}

export async function generateQRCode(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

export async function generateQRPDF(vehicle: Vehicle, clienteIdentificador?: string): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  const title = `${vehicle.brand} ${vehicle.model}`;
  doc.text(title, (pageWidth - doc.getTextWidth(title)) / 2, 30);

  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  const subtitle = `${vehicle.year}${vehicle.version ? ` | ${vehicle.version}` : ""}`;
  doc.text(subtitle, (pageWidth - doc.getTextWidth(subtitle)) / 2, 42);

  doc.setFontSize(14);
  const info = `${vehicle.kilometers.toLocaleString("es-AR")} km`;
  doc.text(info, (pageWidth - doc.getTextWidth(info)) / 2, 54);

  const publicUrl = buildPublicVehicleUrl(vehicle.publicSlug, clienteIdentificador);
  const qrDataUrl = await generateQRCode(publicUrl);
  const qrSize = 120;
  const qrY = 70;
  doc.addImage(qrDataUrl, "PNG", (pageWidth - qrSize) / 2, qrY, qrSize, qrSize);

  doc.setFontSize(12);
  const instruction = "Escaneá el código QR para ver más información";
  doc.text(instruction, (pageWidth - doc.getTextWidth(instruction)) / 2, qrY + qrSize + 15);

  doc.setFontSize(10);
  doc.setTextColor(128, 128, 128);
  const footerText = `ID: ${vehicle.id} | ${vehicle.licensePlate || "Sin patente"}`;
  doc.text(footerText, (pageWidth - doc.getTextWidth(footerText)) / 2, pageHeight - 20);

  doc.setFontSize(9);
  doc.text(publicUrl, (pageWidth - doc.getTextWidth(publicUrl)) / 2, pageHeight - 12);

  doc.save(`QR_${vehicle.brand}_${vehicle.model}_${vehicle.year}.pdf`);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
