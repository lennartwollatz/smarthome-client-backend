import { describe, expect, it } from "vitest";
import {
  BMW_DEFAULT_TANK_CAPACITY_LITERS,
  BMW_DRIVER_DOOR_KEY,
  buildLocationTrack,
  buildTripFromInterval,
  collectDriverDoorOpenEvents,
  detectTripIntervalsFromDoorOpenEvents,
  detectTripsFromHistorySeries,
  detectTripsFromTrack,
  type BmwCarTripPoint
} from "../bmwCarTripDetector.js";
import { groupCarTrips } from "../bmwCarTripGrouper.js";

const MILEAGE_KEY = "vehicle.vehicle.travelledDistance";
const RANGE_KEY = "vehicle.drivetrain.lastRemainingRange";
const FUEL_KEY = "vehicle.drivetrain.fuelSystem.level";
const LAT_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.latitude";
const LNG_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.longitude";

function doorSeries(times: number[]): Record<string, { time: number; value: unknown }[]> {
  const points: { time: number; value: unknown }[] = [];
  for (const t of times) {
    points.push({ time: t - 1, value: false });
    points.push({ time: t, value: true });
    points.push({ time: t + 1_000, value: false });
  }
  return { [BMW_DRIVER_DOOR_KEY]: points };
}

describe("bmwCarTripDetector", () => {
  it("erkennt eine Fahrt aus zusammenhängenden GPS-Punkten", () => {
    const base = Date.UTC(2026, 4, 15, 8, 0, 0);
    const track: BmwCarTripPoint[] = [
      { time: base, lat: 48.1351, lng: 11.582 },
      { time: base + 5 * 60_000, lat: 48.14, lng: 11.59 },
      { time: base + 10 * 60_000, lat: 48.15, lng: 11.6 }
    ];
    const trips = detectTripsFromTrack(track);
    expect(trips.length).toBe(1);
    expect(trips[0].distanceKm).toBeGreaterThan(0.3);
    expect(trips[0].points.length).toBe(3);
  });

  it("baut Track aus getrennten Lat/Lng-Serien", () => {
    const t = Date.UTC(2026, 4, 15, 10, 0, 0);
    const series = {
      [LAT_KEY]: [
        { time: t, value: 48.1 },
        { time: t + 60_000, value: 48.2 }
      ],
      [LNG_KEY]: [
        { time: t, value: 11.5 },
        { time: t + 60_000, value: 11.6 }
      ]
    };
    const track = buildLocationTrack(series);
    expect(track.length).toBeGreaterThanOrEqual(2);
  });

  it("collectDriverDoorOpenEvents erfasst nur false → true Übergänge", () => {
    const t = Date.UTC(2026, 4, 15, 8, 0, 0);
    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: t, value: false },
        { time: t + 1_000, value: true },
        { time: t + 5_000, value: false },
        { time: t + 10_000, value: true },
        { time: t + 11_000, value: true },
        { time: t + 15_000, value: false }
      ]
    };
    const events = collectDriverDoorOpenEvents(series);
    expect(events.map(e => e.time)).toEqual([t + 1_000, t + 10_000]);
  });

  it("erkennt Fahrten aus paarweise aufeinanderfolgenden Tür-Auf-Events", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const tStart1 = Date.UTC(2026, 4, 15, 18, 0, 0);
    const tEnd1 = Date.UTC(2026, 4, 15, 18, 16, 0);
    const tStart2 = Date.UTC(2026, 4, 15, 18, 30, 0);
    const tEnd2 = Date.UTC(2026, 4, 15, 18, 41, 0);

    const series = {
      ...doorSeries([tStart1, tEnd1, tStart2, tEnd2]),
      [MILEAGE_KEY]: [
        { time: tStart1, value: 3400 },
        { time: tEnd1, value: 3417 },
        { time: tStart2, value: 3420 },
        { time: tEnd2, value: 3455 }
      ],
      [LAT_KEY]: [
        { time: tStart1, value: 53.58 },
        { time: tEnd1, value: 53.72 },
        { time: tStart2, value: 53.72 },
        { time: tEnd2, value: 53.85 }
      ],
      [LNG_KEY]: [
        { time: tStart1, value: 9.97 },
        { time: tEnd1, value: 10.12 },
        { time: tStart2, value: 10.12 },
        { time: tEnd2, value: 10.28 }
      ]
    };

    const intervals = detectTripIntervalsFromDoorOpenEvents(series, fromMs, toMs);
    expect(intervals.length).toBe(2);
    expect(intervals[0]).toEqual({ startTime: tStart1, endTime: tEnd1 });
    expect(intervals[1]).toEqual({ startTime: tStart2, endTime: tEnd2 });

    const trips = detectTripsFromHistorySeries(series, fromMs, toMs, { tankCapacityLiters: 60 });
    expect(trips.length).toBe(2);
    expect(trips[1].mileageDrivenKm).toBe(17);
    expect(trips[0].mileageDrivenKm).toBe(35);
  });

  it("gruppiert aufeinanderfolgende Fahrten mit Pause < 15 Minuten", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const tStart1 = Date.UTC(2026, 4, 15, 18, 0, 0);
    const tEnd1 = Date.UTC(2026, 4, 15, 18, 16, 0);
    const tStart2 = Date.UTC(2026, 4, 15, 18, 30, 0);
    const tEnd2 = Date.UTC(2026, 4, 15, 18, 41, 0);

    const series = {
      ...doorSeries([tStart1, tEnd1, tStart2, tEnd2]),
      [MILEAGE_KEY]: [
        { time: tStart1, value: 3400 },
        { time: tEnd1, value: 3417 },
        { time: tStart2, value: 3420 },
        { time: tEnd2, value: 3455 }
      ],
      [LAT_KEY]: [
        { time: tStart1, value: 53.58 },
        { time: tEnd2, value: 53.85 }
      ],
      [LNG_KEY]: [
        { time: tStart1, value: 9.97 },
        { time: tEnd2, value: 10.28 }
      ]
    };

    const trips = detectTripsFromHistorySeries(series, fromMs, toMs);
    const entries = groupCarTrips(trips);
    expect(entries.length).toBe(1);
    expect(entries[0].grouped).toBe(true);
    expect(entries[0].autoGrouped).toBe(true);
    expect(entries[0].segments.length).toBe(2);
  });

  it("berechnet Distanz aus Restreichweite wenn Tachostand fehlt", () => {
    const start = Date.UTC(2026, 4, 15, 8, 0, 0);
    const end = Date.UTC(2026, 4, 15, 9, 0, 0);
    const trip = buildTripFromInterval(
      { startTime: start, endTime: end },
      [
        { time: start, lat: 53.58, lng: 9.97 },
        { time: end, lat: 53.72, lng: 10.12 }
      ],
      {
        rangeSeries: [
          { time: start, value: 335 },
          { time: end, value: 318 }
        ],
        fuelSeries: [
          { time: start, value: 80 },
          { time: end, value: 72 }
        ],
        tankCapacityLiters: 60
      }
    );
    expect(trip.mileageDrivenKm).toBe(17);
    expect(trip.distanceKm).toBe(17);
  });

  it("liefert keine Fahrt ohne Tür-Auf-Events", () => {
    expect(
      detectTripIntervalsFromDoorOpenEvents(
        {},
        Date.UTC(2026, 4, 1),
        Date.UTC(2026, 4, 30)
      )
    ).toEqual([]);
  });

  it("liefert offene Fahrt bei ungerader Tür-Auf-Anzahl", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const t1 = Date.UTC(2026, 4, 15, 8, 0, 0);
    const t2 = Date.UTC(2026, 4, 15, 9, 0, 0);
    const t3 = Date.UTC(2026, 4, 15, 16, 0, 0);
    const series = doorSeries([t1, t2, t3]);

    const intervals = detectTripIntervalsFromDoorOpenEvents(series, fromMs, toMs);
    expect(intervals.length).toBe(2);
    expect(intervals[0]).toEqual({ startTime: t1, endTime: t2 });
    expect(intervals[1]).toEqual({ startTime: t3, endTime: toMs });
  });

  it("klippt Trip-Starts ausserhalb [fromMs, toMs]", () => {
    const fromMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const toMs = Date.UTC(2026, 4, 15, 14, 0, 0);
    const beforeStart = Date.UTC(2026, 4, 15, 10, 0, 0);
    const beforeEnd = Date.UTC(2026, 4, 15, 10, 30, 0);
    const insideStart = Date.UTC(2026, 4, 15, 12, 30, 0);
    const insideEnd = Date.UTC(2026, 4, 15, 13, 0, 0);
    const series = doorSeries([beforeStart, beforeEnd, insideStart, insideEnd]);

    const intervals = detectTripIntervalsFromDoorOpenEvents(series, fromMs, toMs);
    expect(intervals.map(i => i.startTime)).toEqual([insideStart]);
  });

  it("simuliert Morgenfahrt am 26.05. mit echten Event-Zeiten", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 31, 23, 59, 59);
    const day = (h: number, m: number) => Date.UTC(2026, 4, 26, h, m, 0);

    const series = {
      ...doorSeries([day(5, 5), day(5, 51)]),
      [MILEAGE_KEY]: [
        { time: day(5, 5), value: 42000 },
        { time: day(5, 51), value: 42020 }
      ],
      [RANGE_KEY]: [
        { time: day(5, 5), value: 335 },
        { time: day(5, 51), value: 321 }
      ],
      [LAT_KEY]: [
        { time: day(5, 5), value: 53.581 },
        { time: day(5, 30), value: 53.65 },
        { time: day(5, 50), value: 53.8 }
      ],
      [LNG_KEY]: [
        { time: day(5, 5), value: 9.967 },
        { time: day(5, 30), value: 10.1 },
        { time: day(5, 50), value: 10.34 }
      ]
    };

    const trips = detectTripsFromHistorySeries(series, fromMs, toMs);
    expect(trips.length).toBe(1);
    expect(trips[0].startTime).toBe(day(5, 5));
    expect(trips[0].endTime).toBe(day(5, 51));
    expect(trips[0].mileageDrivenKm).toBe(20);
    expect(trips[0].points.length).toBeGreaterThan(1);
  });

  it("detectTripsFromHistorySeries kombiniert Tür, Tacho, Tank und GPS", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const tOpen = Date.UTC(2026, 4, 15, 8, 0, 0);
    const tEnd = Date.UTC(2026, 4, 15, 9, 0, 0);
    const series = {
      ...doorSeries([tOpen, tEnd]),
      [MILEAGE_KEY]: [
        { time: tOpen, value: 42000 },
        { time: tEnd, value: 42045 }
      ],
      [FUEL_KEY]: [
        { time: tOpen, value: 80 },
        { time: tEnd, value: 72 }
      ],
      [LAT_KEY]: [
        { time: tOpen, value: 48.1 },
        { time: tEnd, value: 48.25 }
      ],
      [LNG_KEY]: [
        { time: tOpen, value: 11.5 },
        { time: tEnd, value: 11.65 }
      ]
    };
    const trips = detectTripsFromHistorySeries(series, fromMs, toMs, {
      tankCapacityLiters: 60
    });
    expect(trips.length).toBe(1);
    expect(trips[0].mileageDrivenKm).toBe(45);
    expect(trips[0].fuelUsedLiters).toBe(4.8);
    expect(trips[0].fuelConsumptionPer100Km).toBeCloseTo(10.7, 1);
  });

  it("liefert Fahrt ohne GPS mit Dauer aus Intervall", () => {
    const start = Date.UTC(2026, 4, 15, 8, 0, 0);
    const end = Date.UTC(2026, 4, 15, 8, 15, 0);
    const trip = buildTripFromInterval({ startTime: start, endTime: end }, []);
    expect(trip.distanceKm).toBe(0);
    expect(trip.durationMin).toBe(15);
    expect(trip.points.length).toBe(0);
  });

  it("exportiert sinnvolle Defaults", () => {
    expect(BMW_DEFAULT_TANK_CAPACITY_LITERS).toBe(60);
  });
});
