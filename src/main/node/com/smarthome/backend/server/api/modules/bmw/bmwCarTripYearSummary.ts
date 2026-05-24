import type { BmwTripCategory } from "./bmwCarTripCategory.js";
import type { BmwCarTripEntry } from "./bmwCarTripGrouper.js";

export type BmwTripYearSummary = {
  year: number;
  totalKm: number;
  businessKm: number;
  privateKm: number;
  businessSharePercent: number;
  privateSharePercent: number;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function entryDrivenKm(entry: BmwCarTripEntry): number {
  const km = entry.mileageDrivenKm ?? entry.distanceKm;
  return km != null && Number.isFinite(km) && km > 0 ? km : 0;
}

export function yearBoundsMs(year: number): { fromMs: number; toMs: number } {
  const fromMs = new Date(year, 0, 1, 0, 0, 0, 0).getTime();
  const endOfYear = new Date(year + 1, 0, 1, 0, 0, 0, 0).getTime() - 1;
  const toMs = Math.min(Date.now(), endOfYear);
  return { fromMs, toMs };
}

/**
 * Summiert gefahrene Kilometer im Kalenderjahr nach Kategorie.
 * Gesamt-km = alle Fahrten; Anteile beziehen sich auf dieses Jahresgesamt.
 */
export function computeTripYearSummary(
  entries: BmwCarTripEntry[],
  year: number
): BmwTripYearSummary {
  const { fromMs, toMs } = yearBoundsMs(year);

  let totalKm = 0;
  let businessKm = 0;
  let privateKm = 0;

  for (const entry of entries) {
    if (entry.startTime < fromMs || entry.startTime > toMs) continue;
    const km = entryDrivenKm(entry);
    if (km <= 0) continue;

    totalKm += km;
    const cat: BmwTripCategory | undefined = entry.tripCategory;
    if (cat === "business") {
      businessKm += km;
    } else if (cat === "private") {
      privateKm += km;
    }
  }

  const businessSharePercent = totalKm > 0 ? round1((businessKm / totalKm) * 100) : 0;
  const privateSharePercent = totalKm > 0 ? round1((privateKm / totalKm) * 100) : 0;

  return {
    year,
    totalKm: round1(totalKm),
    businessKm: round1(businessKm),
    privateKm: round1(privateKm),
    businessSharePercent,
    privateSharePercent
  };
}
