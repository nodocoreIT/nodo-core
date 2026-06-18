/** Matches SQL priority: contract snapshot → property rate → owner contact rate → fallback. */
export function resolveCommissionRatePercent(input: {
  contractCommissionAmount?: number | null;
  contractRentAmount?: number | null;
  propertyCommissionRate?: number | null;
  ownerCommissionRate?: number | null;
  fallback?: number;
}): number {
  const {
    contractCommissionAmount,
    contractRentAmount,
    propertyCommissionRate,
    ownerCommissionRate,
    fallback = 10,
  } = input;

  if (
    contractCommissionAmount != null &&
    contractRentAmount != null &&
    contractRentAmount > 0
  ) {
    return Math.round((contractCommissionAmount / contractRentAmount) * 10000) / 100;
  }
  if (propertyCommissionRate != null) return propertyCommissionRate;
  if (ownerCommissionRate != null) return ownerCommissionRate;
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
