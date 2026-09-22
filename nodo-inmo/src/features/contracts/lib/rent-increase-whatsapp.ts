import { ADJUSTMENT_INDEX_LABELS, formatMoney } from "./contract-labels";

export function toWhatsAppPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) {
    return digits[2] === "9" ? digits : `549${digits.slice(2)}`;
  }
  const local = digits.replace(/^0/, "").replace(/^15/, "");
  return local.length >= 8 ? `549${local}` : null;
}

export function buildRentIncreaseWhatsAppMessage(input: {
  tenantName: string;
  agencyName: string;
  propertyAddress: string;
  adjustmentIndex: string;
  nextAdjustmentDate: string | null;
  rentAmount: number;
  currency: string;
}): string {
  const agency = input.agencyName.trim() || "la inmobiliaria";
  const indexLabel =
    ADJUSTMENT_INDEX_LABELS[input.adjustmentIndex] ?? input.adjustmentIndex;
  const dateLabel = input.nextAdjustmentDate
    ? new Date(input.nextAdjustmentDate + "T12:00:00").toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "el próximo mes";
  const firstName = input.tenantName.trim().split(/\s+/)[0] || "Buenas";

  return [
    `Hola ${firstName}, me contacto desde la inmobiliaria ${agency}.`,
    `Según lo acordado en el contrato de ${input.propertyAddress}, queríamos informarle que a partir del ${dateLabel} se actualizará el alquiler en base al índice ${indexLabel} previsto en el contrato.`,
    `El alquiler actual es de ${formatMoney(input.rentAmount, input.currency)}.`,
    `Quedamos a disposición ante cualquier consulta.`,
  ].join(" ");
}

export function openRentIncreaseWhatsApp(
  phone: string,
  message: string,
): boolean {
  const waPhone = toWhatsAppPhone(phone);
  if (!waPhone) return false;
  window.open(
    `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener,noreferrer",
  );
  return true;
}
