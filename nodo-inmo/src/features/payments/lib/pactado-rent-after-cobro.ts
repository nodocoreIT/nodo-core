/**
 * `payments.amount` is alquiler pactado. Expensas live in expenses_amount /
 * payment_charges. Receiving more than the pactado (e.g. typing the cuota
 * total in "monto recibido") must not rewrite the rent.
 */
export function pactadoRentAfterCobro(isPaid: boolean, currentPactado: number, receivedRent: number): number {
  return isPaid ? receivedRent : currentPactado;
}
