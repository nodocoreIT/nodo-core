export function currencySymbol(currency?: string | null) {
  return currency?.toUpperCase() === "USD" ? "US$" : "$";
}

export function formatThousands(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "";
  return value.toLocaleString("es-AR");
}

export function parseThousands(raw: string): number | undefined {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits) : undefined;
}
