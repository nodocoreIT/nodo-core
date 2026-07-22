/** Normaliza celular argentino a E.164 (+54911…). */
export function normalizeArMobilePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("54")) {
    return `+${digits}`;
  }

  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // 11 1234-5678 → +5491112345678
  if (digits.length === 10 && digits.startsWith("11")) {
    return `+549${digits}`;
  }

  // 91112345678
  if (digits.length === 11 && digits.startsWith("9")) {
    return `+54${digits}`;
  }

  if (digits.length >= 10 && digits.length <= 12) {
    return digits.startsWith("9") ? `+54${digits}` : `+549${digits}`;
  }

  return null;
}

export function formatArPhoneDisplay(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.startsWith("549") && d.length >= 12) {
    const local = d.slice(3);
    return `+54 9 ${local.slice(0, 2)} ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return e164;
}
