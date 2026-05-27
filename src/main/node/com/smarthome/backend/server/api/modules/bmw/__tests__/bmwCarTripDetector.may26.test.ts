import { describe, expect, it } from "vitest";
import {
  BMW_DRIVER_DOOR_KEY,
  collectDriverDoorOpenEvents,
  detectTripIntervalsFromDoorOpenEvents,
  detectTripsFromHistorySeries
} from "../bmwCarTripDetector.js";

const LAT_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.latitude";
const LNG_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.longitude";
const RANGE_KEY = "vehicle.drivetrain.lastRemainingRange";
const MILEAGE_KEY = "vehicle.vehicle.travelledDistance";

/** Simuliert echte Daten vom 26.05.2026 (Screenshots des Users). */
function may26(ms: number, h: number, m: number): number {
  return new Date(2026, 4, 26, h, m, ms, 0).getTime();
}

describe("bmwCarTripDetector May 26 real scenario", () => {
  const series = {
    [BMW_DRIVER_DOOR_KEY]: [
      { time: may26(0, 7, 5), value: true },
      { time: may26(0, 7, 5), value: false },
      { time: may26(0, 7, 51), value: true },
      { time: may26(0, 7, 51), value: false },
      { time: may26(0, 12, 3), value: true },
      { time: may26(0, 12, 3), value: false },
      { time: may26(0, 12, 7), value: true },
      { time: may26(0, 12, 7), value: false },
      { time: may26(0, 12, 16), value: true },
      { time: may26(0, 12, 16), value: false }
    ],
    [RANGE_KEY]: [
      { time: may26(0, 7, 8), value: 335 },
      { time: may26(0, 7, 49), value: 330 },
      { time: may26(0, 12, 6), value: 324 },
      { time: may26(0, 12, 16), value: 321 }
    ],
    [MILEAGE_KEY]: [
      { time: may26(0, 7, 5), value: 42000 },
      { time: may26(0, 7, 51), value: 42000 }
    ],
    [LAT_KEY]: [
      { time: may26(0, 7, 5), value: 53.5812375 },
      { time: may26(0, 7, 11), value: 53.5649938889 },
      { time: may26(0, 7, 50), value: 53.7999441667 },
      { time: may26(0, 12, 4), value: 53.7999441667 }
    ],
    [LNG_KEY]: [
      { time: may26(0, 7, 5), value: 9.9669172222 },
      { time: may26(0, 7, 11), value: 9.9833483333 },
      { time: may26(0, 7, 50), value: 10.3433483333 },
      { time: may26(0, 12, 4), value: 10.3432844444 }
    ]
  };

  const fromMs = new Date(2026, 4, 1, 0, 0, 0, 0).getTime();
  const toMs = new Date(2026, 4, 31, 23, 59, 59, 999).getTime();

  it("findet Tür-Auf-Events", () => {
    const events = collectDriverDoorOpenEvents(series);
    expect(events.length).toBeGreaterThanOrEqual(4);
  });

  it("erkennt Fahrten im Mai 2026", () => {
    const intervals = detectTripIntervalsFromDoorOpenEvents(series, fromMs, toMs);
    expect(intervals.length).toBeGreaterThan(0);
  });

  it("liefert Trip-Objekte für getTrips", () => {
    const trips = detectTripsFromHistorySeries(series, fromMs, toMs, { tankCapacityLiters: 60 });
    expect(trips.length).toBeGreaterThan(0);
  });
});
