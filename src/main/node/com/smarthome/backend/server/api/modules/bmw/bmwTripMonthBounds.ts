/** month: 1–12 (Kalendermonat) */
export function monthBoundsMs(year: number, month: number): { fromMs: number; toMs: number } {
  const fromMs = new Date(year, month - 1, 1, 0, 0, 0, 0).getTime();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();
  const toMs = Math.min(Date.now(), endOfMonth);
  return { fromMs, toMs };
}

export type BmwTripMonth = { year: number; month: number };

export function monthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function compareMonths(a: BmwTripMonth, b: BmwTripMonth): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}
