export function formatCurrencyInput(
  value: string | number | null | undefined,
  currency: "ARS" | "USD" = "ARS",
): string {
  if (value === null || value === undefined) return "";
  const clean = String(value).replace(/\D/g, "");
  if (!clean) return "";
  const formatted = Number(clean).toLocaleString("de-DE");
  const prefix = currency === "ARS" ? "$ " : "US$ ";
  return `${prefix}${formatted}`;
}

export function parseCurrencyInput(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const clean = String(value).replace(/\D/g, "");
  if (!clean) return null;
  const n = Number(clean);
  return isNaN(n) ? null : n;
}

export function formatMoney(amount: number, currency: "ARS" | "USD"): string {
  const prefix = currency === "USD" ? "US$" : "$";
  return `${prefix} ${amount.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
