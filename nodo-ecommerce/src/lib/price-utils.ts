export const LIST_PRICE_FACTOR = 1.2236;

export function calculateListPrice(price: number): number {
  return price * LIST_PRICE_FACTOR;
}

export function calculateInstallment(price: number, installments: number = 3): number {
  return (price * LIST_PRICE_FACTOR) / installments;
}

export function formatPrice(price: number): string {
  return `$${Math.round(price).toLocaleString("es-AR")}`;
}
