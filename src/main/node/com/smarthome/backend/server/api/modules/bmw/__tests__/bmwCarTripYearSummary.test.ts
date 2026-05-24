import { describe, expect, it } from "vitest";
import { computeTripYearSummary } from "../bmwCarTripYearSummary.js";
import type { BmwCarTripEntry } from "../bmwCarTripGrouper.js";

function entry(id: string, startTime: number, km: number, tripCategory?: "private" | "business"): BmwCarTripEntry {
  return {
    id,
    grouped: false,
    autoGrouped: false,
    startTime,
    endTime: startTime + 3_600_000,
    distanceKm: km,
    durationMin: 60,
    durationHours: 1,
    durationMinutes: 0,
    mileageDrivenKm: km,
    tripCategory,
    start: { lat: 0, lng: 0 },
    end: { lat: 0, lng: 0 },
    points: [],
    segmentMarkers: [],
    segments: []
  };
}

describe("bmwCarTripYearSummary", () => {
  it("summiert berufliche und private km mit Anteilen", () => {
    const year = 2026;
    const t1 = Date.UTC(2026, 2, 10, 8, 0, 0);
    const t2 = Date.UTC(2026, 2, 11, 8, 0, 0);
    const summary = computeTripYearSummary(
      [
        entry("a", t1, 100, "business"),
        entry("b", t2, 50, "private"),
        entry("c", t2 + 86_400_000, 30)
      ],
      year
    );
    expect(summary.businessKm).toBe(100);
    expect(summary.privateKm).toBe(50);
    expect(summary.totalKm).toBe(180);
    expect(summary.businessSharePercent).toBeCloseTo(55.6, 0);
    expect(summary.privateSharePercent).toBeCloseTo(27.8, 0);
  });
});
