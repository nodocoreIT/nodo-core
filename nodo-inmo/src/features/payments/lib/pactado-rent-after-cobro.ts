/** ARS cobros don't use cents; IPC leftovers like 0.03 can't be typed in the form. */
export function roundPesos(amount: number): number {
  return Math.round(amount);
}

/**
 * `payments.amount` is alquiler pactado. Expensas live in expenses_amount /
 * payment_charges. Receiving more than the pactado (e.g. typing the cuota
 * total in "monto recibido") must not rewrite the rent.
 */
export function pactadoRentAfterCobro(isPaid: boolean, currentPactado: number, receivedRent: number): number {
  return isPaid ? roundPesos(receivedRent) : roundPesos(currentPactado);
}

export function settleCobroRent(input: {
  isPaid: boolean;
  pactado: number;
  alreadyPaid: number;
  received: number;
}): { amount: number; paidAmount: number; isFullyPaid: boolean } {
  const pactado = roundPesos(input.pactado);
  if (input.isPaid) {
    const amount = roundPesos(input.received);
    return { amount, paidAmount: amount, isFullyPaid: true };
  }
  const paidRent = roundPesos(input.alreadyPaid) + roundPesos(input.received);
  const isFullyPaid = paidRent >= pactado;
  return {
    amount: pactado,
    paidAmount: isFullyPaid ? pactado : paidRent,
    isFullyPaid,
  };
}
