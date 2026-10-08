/** Last cobrado alquiler strictly before the month the increase was applied. */
export function previousRentBeforeAdjustment(
  payments: { contract_id: string; status: string; period: string; amount: number }[],
  contractId: string,
  lastAdjustmentDate: string,
): number | null {
  const cutoff = lastAdjustmentDate.slice(0, 7);
  const paid = payments
    .filter(
      (p) =>
        p.contract_id === contractId &&
        p.status === "paid" &&
        p.period.slice(0, 7) < cutoff,
    )
    .sort((a, b) => b.period.localeCompare(a.period));
  return paid[0]?.amount ?? null;
}
