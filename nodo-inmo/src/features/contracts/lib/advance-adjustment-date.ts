/** Adds `months` to an ISO date, clamping the day-of-month to the target month's length. */
export function advanceAdjustmentDate(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const totalMonths = m - 1 + months;
  const year = y + Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12; // 0-based
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(d, daysInMonth);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}
