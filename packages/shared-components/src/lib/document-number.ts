export type DocumentNumberFormat = "dni" | "cuit" | "free";

/** Strip non-digits — use before persisting or validating. */
export function normalizeDocumentDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Thousand separators (es-AR dots), preserves leading zeros in the digit string. */
export function formatDocumentThousands(digits: string): string {
  const clean = digits.replace(/\D/g, "");
  if (!clean) return "";
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** CUIT / CUIL mask: XX-XXXXXXXX-X */
export function formatCuitInput(digits: string): string {
  const clean = digits.replace(/\D/g, "").slice(0, 11);
  if (!clean) return "";
  if (clean.length <= 2) return clean;
  if (clean.length <= 10) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
  return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
}

export function resolveDocumentFormat(
  documentType?: string | null,
  explicit?: DocumentNumberFormat,
): DocumentNumberFormat {
  if (explicit) return explicit;
  const type = (documentType ?? "dni").toLowerCase();
  if (type === "cuit" || type === "cuil") return "cuit";
  if (type === "pasaporte" || type === "passport" || type === "lc" || type === "le") {
    return "free";
  }
  return "dni";
}

/**
 * Format a document number while the user types.
 * DNI → 12.345.678 · CUIT/CUIL → 20-12345678-9 · Pasaporte → sin máscara.
 */
export function formatDocumentNumberInput(
  value: string,
  documentType?: string | null,
  format?: DocumentNumberFormat,
): string {
  const resolved = resolveDocumentFormat(documentType, format);
  if (resolved === "free") return value;
  const digits = normalizeDocumentDigits(value);
  if (!digits) return "";
  if (resolved === "cuit") return formatCuitInput(digits);
  return formatDocumentThousands(digits);
}
