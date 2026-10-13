/** Matches SQL: property → owner contact → contract copy → peso snapshot → fallback. */
export function resolveCommissionRatePercent(input: {
  contractCommissionRate?: number | null;
  contractCommissionAmount?: number | null;
  contractRentAmount?: number | null;
  propertyCommissionRate?: number | null;
  ownerCommissionRate?: number | null;
  fallback?: number;
}): number {
  const {
    contractCommissionRate,
    contractCommissionAmount,
    contractRentAmount,
    propertyCommissionRate,
    ownerCommissionRate,
    fallback = 10,
  } = input;

  if (propertyCommissionRate != null) return propertyCommissionRate;
  if (ownerCommissionRate != null) return ownerCommissionRate;
  if (contractCommissionRate != null) return contractCommissionRate;
  if (
    contractCommissionAmount != null &&
    contractRentAmount != null &&
    contractRentAmount > 0
  ) {
    return Math.round((contractCommissionAmount / contractRentAmount) * 10000) / 100;
  }
  return fallback;
}

export type PropertyCommissionSource = {
  commission_rate?: number | null;
  owner?: { commission_rate?: number | null } | null;
};

export function commissionRateFromProperty(
  property?: PropertyCommissionSource | null,
  fallback = 10,
): number {
  if (!property) return fallback;
  return resolveCommissionRatePercent({
    propertyCommissionRate: property.commission_rate,
    ownerCommissionRate: property.owner?.commission_rate,
    fallback,
  });
}

/** Commission amount for a cobro: always % of rent + expensas. */
export function computeCommissionAmount(
  ratePercent: number,
  rentAmount: number,
  expensesAmount: number,
): number {
  return Math.round((rentAmount + expensesAmount) * ratePercent) / 100;
}
