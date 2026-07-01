/**
 * Returns Tailwind pill classes based on the account name.
 * Order matters: check 'pampa' before 'santander', 'reserva' before generic mercadopago.
 */
export function cuentaPillClass(nombre: string): string {
  const n = nombre.toLowerCase().replace(/\s+/g, '');
  if (n.includes('pampa'))                          return 'bg-orange-100 text-orange-700';
  if (n.includes('santander'))                      return 'bg-red-600 text-white';
  if (n.includes('mercadopago') && n.includes('reserva')) return 'bg-blue-900 text-white';
  if (n.includes('mercadopago') || n.includes('mercadopago')) return 'bg-[#009ee3] text-white';
  if (n.includes('efectivo'))                       return 'bg-emerald-100 text-emerald-800';
  return 'bg-mist text-slate2';
}
