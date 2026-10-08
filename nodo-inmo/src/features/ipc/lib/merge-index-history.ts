function monthKey(period: string): string {
  return period.slice(0, 7);
}

/**
 * Combine official API rows with provisional (manual) rows.
 * When the API already has that month, it replaces the manual value.
 */
export function mergeIndexHistory<T extends { period: string }>(
  official: T[],
  provisional: T[],
): T[] {
  const byKey = new Map<string, T>();
  for (const row of provisional) {
    const key = monthKey(row.period);
    if (key) byKey.set(key, row);
  }
  for (const row of official) {
    const key = monthKey(row.period);
    if (key) byKey.set(key, row);
  }
  return [...byKey.values()].sort((a, b) => b.period.localeCompare(a.period));
}

/** First day of the previous calendar month (`YYYY-MM-01`). INDEC publishes a month late. */
export function previousMonthPeriod(from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
