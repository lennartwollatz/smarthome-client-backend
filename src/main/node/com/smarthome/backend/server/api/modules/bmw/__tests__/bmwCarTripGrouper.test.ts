import { describe, expect, it } from "vitest";
import { BMW_TRIP_GROUP_MAX_STOP_MS, buildTripEntryFromSegments, groupCarTrips } from "../bmwCarTripGrouper.js";
import type { BmwCarTrip } from "../bmwCarTripDetector.js";

function trip(id: string, start: number, end: number, km: number): BmwCarTrip {
  return {
    id,
    startTime: start,
    endTime: end,
    distanceKm: km,
    durationMin: Math.round((end - start) / 60_000),
    durationHours: 0,
    durationMinutes: Math.round((end - start) / 60_000),
    mileageDrivenKm: km,
    start: { lat: 48.1, lng: 11.5 },
    end: { lat: 48.1 + km * 0.001, lng: 11.5 + km * 0.001 },
    points: [
      { time: start, lat: 48.1, lng: 11.5 },
      { time: end, lat: 48.1 + km * 0.001, lng: 11.5 + km * 0.001 }
    ]
  };
}

describe("bmwCarTripGrouper", () => {
  it("gruppiert Fahrten bei Stopp unter 15 Minuten", () => {
    const t0 = Date.UTC(2026, 4, 15, 8, 0, 0);
    const trips = [
      trip("a", t0, t0 + 20 * 60_000, 10),
      trip("b", t0 + 25 * 60_000, t0 + 50 * 60_000, 15)
    ];
    const entries = groupCarTrips(trips);
    expect(entries.length).toBe(1);
    expect(entries[0].grouped).toBe(true);
    expect(entries[0].autoGrouped).toBe(true);
    expect(entries[0].segments.length).toBe(2);
    expect(entries[0].mileageDrivenKm).toBe(25);
    expect(entries[0].segments[0].stopDurationMin).toBe(5);
  });

  it("trennt Fahrten bei Stopp ab 15 Minuten", () => {
    const t0 = Date.UTC(2026, 4, 15, 8, 0, 0);
    const gap = BMW_TRIP_GROUP_MAX_STOP_MS;
    const trips = [
      trip("a", t0, t0 + 20 * 60_000, 10),
      trip("b", t0 + 20 * 60_000 + gap, t0 + 80 * 60_000, 20)
    ];
    const entries = groupCarTrips(trips);
    expect(entries.length).toBe(2);
    expect(entries.every(e => !e.grouped)).toBe(true);
  });

  it("erzeugt Segment-Marker pro Etappe", () => {
    const t0 = Date.UTC(2026, 4, 15, 10, 0, 0);
    const entry = buildTripEntryFromSegments(
      [trip("x", t0, t0 + 30 * 60_000, 5), trip("y", t0 + 35 * 60_000, t0 + 60 * 60_000, 8)],
      { autoGrouped: true }
    );
    expect(entry.segmentMarkers.length).toBe(2);
    expect(entry.segmentMarkers[0].index).toBe(1);
    expect(entry.segmentMarkers[1].index).toBe(2);
  });
});
