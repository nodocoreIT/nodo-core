export function currencySymbol(currency?: string | null) {
  return currency?.toUpperCase() === "USD" ? "US$" : "$";
}
