import { describe, expect, it } from "vitest";
import {
  BMW_DRIVER_DOOR_KEY,
  collectDriverDoorOpenEvents,
  computeDrivenKmBetween,
  detectTripIntervalsFromDoorOpenEvents,
  detectTripsFromHistorySeries
} from "../bmwCarTripDetector.js";

const MILEAGE_KEY = "vehicle.vehicle.travelledDistance";

/** 28.05.2026 lokal (Screenshots des Users). */
function may28(h: number, m: number, s = 0): number {
  return new Date(2026, 4, 28, h, m, s, 0).getTime();
}

describe("bmwCarTripDetector May 28 door + mileage pattern", () => {
  const doorPairs: { open: [number, number]; close: [number, number] }[] = [
    { open: [7, 10], close: [7, 11] },
    { open: [8, 0], close: [8, 0] },
    { open: [12, 24], close: [12, 25] },
    { open: [12, 28], close: [12, 28] },
    { open: [12, 36], close: [12, 36] },
    { open: [12, 43], close: [12, 44] },
    { open: [18, 21], close: [18, 21] },
    { open: [19, 14], close: [19, 14] }
  ];

  const doorSeries = doorPairs.flatMap(({ open, close }) => [
    { time: may28(...open), value: true },
    { time: may28(...close), value: false }
  ]);

  const mileageSeries = [
    [7, 14, 66996],
    [7, 17, 66998],
    [7, 20, 66999],
    [7, 23, 67000],
    [7, 26, 67001],
    [7, 29, 67002],
    [7, 32, 67004],
    [7, 37, 67007],
    [7, 39, 67010],
    [7, 41, 67013],
    [7, 42, 67016],
    [7, 44, 67019],
    [7, 45, 67022],
    [7, 47, 67025],
    [7, 48, 67028],
    [7, 49, 67031],
    [7, 51, 67034],
    [7, 53, 67037],
    [7, 54, 67040],
    [7, 56, 67043],
    [7, 59, 67045],
    [12, 28, 67047],
    [12, 39, 67048],
    [18, 24, 67050],
    [18, 26, 67053],
    [18, 27, 67056],
    [18, 29, 67059]
  ].map(([h, m, v]) => ({ time: may28(h, m), value: v }));

  const series = {
    [BMW_DRIVER_DOOR_KEY]: doorSeries,
    [MILEAGE_KEY]: mileageSeries
  };

  const fromMs = new Date(2026, 4, 1, 0, 0, 0, 0).getTime();
  const toMs = new Date(2026, 4, 31, 23, 59, 59, 999).getTime();

  it("findet alle Tür-Auf-Events", () => {
    expect(collectDriverDoorOpenEvents(series).length).toBe(8);
  });

  it("berechnet Morgen-Fahrt auch wenn Tür vor erstem Kilometerstand öffnet", () => {
    const driven = computeDrivenKmBetween(
      mileageSeries,
      undefined,
      [],
      may28(7, 10),
      may28(8, 0)
    );
    expect(driven).toBe(49);
  });

  it("erkennt Pendelfahrten mit Tachostand", () => {
    const intervals = detectTripIntervalsFromDoorOpenEvents(series, fromMs, toMs);
    const morning = intervals.find(
      i => i.startTime === may28(7, 10) && i.endTime === may28(8, 0)
    );
    const evening = intervals.find(
      i => i.startTime === may28(18, 21) && i.endTime === may28(19, 14)
    );
    expect(morning).toBeDefined();
    expect(evening).toBeDefined();
    expect(intervals.length).toBeGreaterThanOrEqual(2);
  });

  it("erkennt kurze Fahrt wenn Tachostand steigt (12:24–12:28, +2 km)", () => {
    const intervals = detectTripIntervalsFromDoorOpenEvents(series, fromMs, toMs);
    const shortDrive = intervals.find(
      i => i.startTime === may28(12, 24) && i.endTime === may28(12, 28)
    );
    expect(shortDrive).toBeDefined();
    const driven = computeDrivenKmBetween(
      mileageSeries,
      undefined,
      [],
      may28(12, 24),
      may28(12, 28)
    );
    expect(driven).toBe(2);
  });

  it("liefert Trip-Objekte mit gefahrenen Kilometern", () => {
    const trips = detectTripsFromHistorySeries(series, fromMs, toMs);
    expect(trips.length).toBeGreaterThanOrEqual(2);
    const morning = trips.find(t => t.startTime === may28(7, 10));
    expect(morning?.mileageDrivenKm).toBe(49);
  });
});
