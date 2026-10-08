/**
 * Index adjustments (IPC/ICL) apply only to alquiler.
 * Expensas are a separate charge and only change if edited on the contract or at cobro.
 *
 * If rent_amount was stored as alquiler + expensas, use the installment's
 * alquiler (payments.amount) as the base.
 */
export function rentForIndexAdjustment(
  contractRentAmount: number,
  installmentAmount: number,
  expensesAmount: number,
): number {
  if (expensesAmount > 0 && almostEqual(contractRentAmount, installmentAmount + expensesAmount)) {
    return installmentAmount;
  }
  return contractRentAmount;
}

function almostEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.015;
}
