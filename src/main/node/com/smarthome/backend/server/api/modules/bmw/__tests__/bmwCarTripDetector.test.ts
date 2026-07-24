import { describe, expect, it } from "vitest";
import {
  BMW_DEFAULT_TANK_CAPACITY_LITERS,
  BMW_DRIVER_DOOR_KEY,
  BMW_TRIP_STATUS_SILENCE_MS,
  buildLocationTrack,
  buildTripFromInterval,
  collectDriverDoorOpenEvents,
  collectStatusUpdateTimes,
  detectTripIntervalsFromDoorOpenEvents,
  detectTripIntervalsFromStatusUpdates,
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
const IN_USE_KEY = "vehicle.status.car.inUse";

type StatusUpdate = {
  time: number;
  lat?: number;
  lng?: number;
  mileage?: number;
  extra?: Record<string, unknown>;
};

function buildSeriesFromStatusUpdates(
  updates: StatusUpdate[]
): Record<string, { time: number; value: unknown }[]> {
  const series: Record<string, { time: number; value: unknown }[]> = {};
  const push = (key: string, time: number, value: unknown) => {
    (series[key] ??= []).push({ time, value });
  };

  for (const u of updates) {
    push(IN_USE_KEY, u.time, true);
    if (u.lat != null) push(LAT_KEY, u.time, u.lat);
    if (u.lng != null) push(LNG_KEY, u.time, u.lng);
    if (u.mileage != null) push(MILEAGE_KEY, u.time, u.mileage);
    if (u.extra) {
      for (const [key, value] of Object.entries(u.extra)) {
        push(key, u.time, value);
      }
    }
  }
  return series;
}

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

  it("collectStatusUpdateTimes sammelt alle Telemetrie-Zeitpunkte", () => {
    const t = Date.UTC(2026, 4, 15, 8, 0, 0);
    const series = {
      [IN_USE_KEY]: [{ time: t, value: true }],
      [LAT_KEY]: [{ time: t + 1_000, value: 48.1 }],
      [MILEAGE_KEY]: [{ time: t, value: 1000 }, { time: t + 2_000, value: 1001 }]
    };
    expect(collectStatusUpdateTimes(series)).toEqual([t, t + 1_000, t + 2_000]);
  });

  it("startet Fahrt bei Standortwechsel und beendet nach 30 Minuten ohne Status", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const parked = Date.UTC(2026, 4, 15, 8, 0, 0);
    const doorOnly = Date.UTC(2026, 4, 15, 8, 5, 0);
    const depart = Date.UTC(2026, 4, 15, 8, 10, 0);
    const enRoute = Date.UTC(2026, 4, 15, 8, 25, 0);
    const arrive = Date.UTC(2026, 4, 15, 8, 46, 0);
    const parkedAgain = Date.UTC(2026, 4, 15, 8, 50, 0);

    const series = buildSeriesFromStatusUpdates([
      { time: parked, lat: 53.58, lng: 9.97, mileage: 3400 },
      {
        time: doorOnly,
        lat: 53.58,
        lng: 9.97,
        mileage: 3400,
        extra: { [BMW_DRIVER_DOOR_KEY]: true }
      },
      { time: depart, lat: 53.72, lng: 10.12, mileage: 3417 },
      { time: enRoute, lat: 53.78, lng: 10.2, mileage: 3435 },
      { time: arrive, lat: 53.85, lng: 10.28, mileage: 3455 },
      { time: parkedAgain, lat: 53.85, lng: 10.28, mileage: 3455 }
    ]);

    const intervals = detectTripIntervalsFromStatusUpdates(series, fromMs, toMs);
    expect(intervals.length).toBe(1);
    expect(intervals[0].startTime).toBe(doorOnly);
    expect(intervals[0].endTime).toBe(parkedAgain);

    const trips = detectTripsFromHistorySeries(series, fromMs, toMs, { tankCapacityLiters: 60 });
    expect(trips.length).toBe(1);
    expect(trips[0].mileageDrivenKm).toBe(55);
  });

  it("erkennt zwei Fahrten bei erneutem Verlassen des Parkplatzes", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const homePark = Date.UTC(2026, 4, 15, 18, 0, 0);
    const depart1 = Date.UTC(2026, 4, 15, 18, 5, 0);
    const enRoute1 = Date.UTC(2026, 4, 15, 18, 10, 0);
    const arrive1 = Date.UTC(2026, 4, 15, 18, 16, 0);
    const stop1 = Date.UTC(2026, 4, 15, 18, 20, 0);
    const depart2 = stop1 + BMW_TRIP_STATUS_SILENCE_MS + 5 * 60_000;
    const enRoute2 = depart2 + 10 * 60_000;
    const arrive2 = depart2 + 20 * 60_000;
    const stop2 = depart2 + 25 * 60_000;

    const series = buildSeriesFromStatusUpdates([
      { time: homePark, lat: 53.58, lng: 9.97, mileage: 3400 },
      { time: depart1, lat: 53.72, lng: 10.12, mileage: 3417 },
      { time: enRoute1, lat: 53.74, lng: 10.14, mileage: 3418 },
      { time: arrive1, lat: 53.75, lng: 10.15, mileage: 3420 },
      { time: stop1, lat: 53.75, lng: 10.15, mileage: 3420 },
      { time: depart2, lat: 53.85, lng: 10.28, mileage: 3455 },
      { time: enRoute2, lat: 53.86, lng: 10.29, mileage: 3457 },
      { time: arrive2, lat: 53.88, lng: 10.31, mileage: 3460 },
      { time: stop2, lat: 53.88, lng: 10.31, mileage: 3460 }
    ]);

    const intervals = detectTripIntervalsFromStatusUpdates(series, fromMs, toMs);
    expect(intervals.length).toBe(2);
    expect(intervals[0]).toEqual({ startTime: homePark, endTime: stop1 });
    expect(intervals[1]).toEqual({ startTime: stop1, endTime: stop2 });

    const trips = detectTripsFromHistorySeries(series, fromMs, toMs);
    expect(trips.length).toBe(2);
    expect(trips[1].mileageDrivenKm).toBe(20);
    expect(trips[0].mileageDrivenKm).toBe(40);
  });

  it("gruppiert aufeinanderfolgende Fahrten mit Pause < 15 Minuten", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const homePark = Date.UTC(2026, 4, 15, 18, 0, 0);
    const depart1 = Date.UTC(2026, 4, 15, 18, 5, 0);
    const enRoute1 = Date.UTC(2026, 4, 15, 18, 10, 0);
    const arrive1 = Date.UTC(2026, 4, 15, 18, 16, 0);
    const stop1 = Date.UTC(2026, 4, 15, 18, 20, 0);
    const depart2 = stop1 + BMW_TRIP_STATUS_SILENCE_MS + 5 * 60_000;
    const enRoute2 = depart2 + 10 * 60_000;
    const arrive2 = depart2 + 20 * 60_000;
    const stop2 = depart2 + 25 * 60_000;

    const series = buildSeriesFromStatusUpdates([
      { time: homePark, lat: 53.58, lng: 9.97, mileage: 3400 },
      { time: depart1, lat: 53.72, lng: 10.12, mileage: 3417 },
      { time: enRoute1, lat: 53.74, lng: 10.14, mileage: 3418 },
      { time: arrive1, lat: 53.75, lng: 10.15, mileage: 3420 },
      { time: stop1, lat: 53.75, lng: 10.15, mileage: 3420 },
      { time: depart2, lat: 53.85, lng: 10.28, mileage: 3455 },
      { time: enRoute2, lat: 53.86, lng: 10.29, mileage: 3457 },
      { time: arrive2, lat: 53.88, lng: 10.31, mileage: 3460 },
      { time: stop2, lat: 53.88, lng: 10.31, mileage: 3460 }
    ]);

    const trips = detectTripsFromHistorySeries(series, fromMs, toMs);
    const entries = groupCarTrips(trips);
    expect(entries.length).toBe(1);
    expect(entries[0].grouped).toBe(true);
    expect(entries[0].autoGrouped).toBe(true);
    expect(entries[0].segments.length).toBe(2);
  });

  it("liefert keine Fahrt bei Status ohne Bewegung", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const t1 = Date.UTC(2026, 4, 15, 8, 0, 0);
    const t2 = Date.UTC(2026, 4, 15, 8, 5, 0);
    const t3 = Date.UTC(2026, 4, 15, 8, 10, 0);

    const series = buildSeriesFromStatusUpdates([
      { time: t1, lat: 53.58, lng: 9.97, mileage: 3400 },
      {
        time: t2,
        lat: 53.58,
        lng: 9.97,
        mileage: 3400,
        extra: { [BMW_DRIVER_DOOR_KEY]: true }
      },
      {
        time: t3,
        lat: 53.58,
        lng: 9.97,
        mileage: 3400,
        extra: { [BMW_DRIVER_DOOR_KEY]: false }
      }
    ]);

    expect(detectTripIntervalsFromStatusUpdates(series, fromMs, toMs)).toEqual([]);
  });

  it("beendet Fahrt nach 30 Minuten Funkstille auch mitten in der Abfrage", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const parked = Date.UTC(2026, 4, 15, 8, 0, 0);
    const depart = Date.UTC(2026, 4, 15, 8, 10, 0);
    const enRoute = Date.UTC(2026, 4, 15, 8, 25, 0);
    const lastStatus = Date.UTC(2026, 4, 15, 8, 46, 0);
    const afterSilence = lastStatus + BMW_TRIP_STATUS_SILENCE_MS + 60_000;

    const series = buildSeriesFromStatusUpdates([
      { time: parked, lat: 53.58, lng: 9.97, mileage: 3400 },
      { time: depart, lat: 53.72, lng: 10.12, mileage: 3417 },
      { time: enRoute, lat: 53.78, lng: 10.2, mileage: 3435 },
      { time: lastStatus, lat: 53.85, lng: 10.28, mileage: 3455 },
      { time: afterSilence, lat: 53.85, lng: 10.28, mileage: 3455 }
    ]);

    const intervals = detectTripIntervalsFromStatusUpdates(series, fromMs, toMs);
    expect(intervals.length).toBe(1);
    expect(intervals[0].endTime).toBe(lastStatus);
  });

  it("liefert offene Fahrt wenn letzter Status weniger als 30 Minuten vor toMs liegt", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 15, 9, 40, 0);
    const parked = Date.UTC(2026, 4, 15, 8, 0, 0);
    const depart = Date.UTC(2026, 4, 15, 8, 10, 0);
    const enRoute = Date.UTC(2026, 4, 15, 8, 30, 0);
    const almostThere = Date.UTC(2026, 4, 15, 8, 50, 0);
    const lastStatus = Date.UTC(2026, 4, 15, 9, 15, 0);

    const series = buildSeriesFromStatusUpdates([
      { time: parked, lat: 53.58, lng: 9.97, mileage: 3400 },
      { time: depart, lat: 53.72, lng: 10.12, mileage: 3417 },
      { time: enRoute, lat: 53.78, lng: 10.2, mileage: 3435 },
      { time: almostThere, lat: 53.82, lng: 10.24, mileage: 3448 },
      { time: lastStatus, lat: 53.85, lng: 10.28, mileage: 3455 }
    ]);

    const intervals = detectTripIntervalsFromStatusUpdates(series, fromMs, toMs);
    expect(intervals.length).toBe(1);
    expect(intervals[0].endTime).toBe(toMs);
  });

  it("klippt Trip-Starts ausserhalb [fromMs, toMs]", () => {
    const fromMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const toMs = Date.UTC(2026, 4, 15, 14, 0, 0);
    const beforePark = Date.UTC(2026, 4, 15, 10, 0, 0);
    const beforeDepart = Date.UTC(2026, 4, 15, 10, 10, 0);
    const beforeEnRoute = Date.UTC(2026, 4, 15, 10, 20, 0);
    const beforeStop = Date.UTC(2026, 4, 15, 10, 40, 0);
    const insidePark = Date.UTC(2026, 4, 15, 12, 10, 0);
    const insideDepart = Date.UTC(2026, 4, 15, 12, 20, 0);
    const insideEnRoute = Date.UTC(2026, 4, 15, 12, 35, 0);
    const insideStop = Date.UTC(2026, 4, 15, 12, 50, 0);

    const series = buildSeriesFromStatusUpdates([
      { time: beforePark, lat: 53.58, lng: 9.97, mileage: 3400 },
      { time: beforeDepart, lat: 53.72, lng: 10.12, mileage: 3417 },
      { time: beforeEnRoute, lat: 53.74, lng: 10.14, mileage: 3418 },
      { time: beforeStop, lat: 53.75, lng: 10.15, mileage: 3420 },
      { time: insidePark, lat: 53.75, lng: 10.15, mileage: 3420 },
      { time: insideDepart, lat: 53.85, lng: 10.28, mileage: 3455 },
      { time: insideEnRoute, lat: 53.86, lng: 10.29, mileage: 3457 },
      { time: insideStop, lat: 53.88, lng: 10.31, mileage: 3460 }
    ]);

    const intervals = detectTripIntervalsFromStatusUpdates(series, fromMs, toMs);
    expect(intervals.map(i => i.startTime)).toEqual([insidePark]);
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

  it("simuliert Morgenfahrt am 26.05. mit Status-Updates", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 31, 23, 59, 59);
    const day = (h: number, m: number) => Date.UTC(2026, 4, 26, h, m, 0);

    const series = buildSeriesFromStatusUpdates([
      { time: day(5, 0), lat: 53.581, lng: 9.967, mileage: 42000 },
      { time: day(5, 5), lat: 53.581, lng: 9.967, mileage: 42000 },
      { time: day(5, 10), lat: 53.65, lng: 10.1, mileage: 42010 },
      { time: day(5, 30), lat: 53.65, lng: 10.1, mileage: 42015 },
      { time: day(5, 50), lat: 53.8, lng: 10.34, mileage: 42020 },
      { time: day(5, 51), lat: 53.8, lng: 10.34, mileage: 42020 }
    ]);

    const trips = detectTripsFromHistorySeries(series, fromMs, toMs);
    expect(trips.length).toBe(1);
    expect(trips[0].startTime).toBe(day(5, 5));
    expect(trips[0].endTime).toBe(day(5, 51));
    expect(trips[0].mileageDrivenKm).toBe(20);
    expect(trips[0].points.length).toBeGreaterThan(1);
  });

  it("detectTripsFromHistorySeries kombiniert Status, Tacho, Tank und GPS", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const parked = Date.UTC(2026, 4, 15, 8, 0, 0);
    const depart = Date.UTC(2026, 4, 15, 8, 10, 0);
    const enRoute = Date.UTC(2026, 4, 15, 8, 30, 0);
    const arrive = Date.UTC(2026, 4, 15, 8, 55, 0);

    const series = buildSeriesFromStatusUpdates([
      { time: parked, lat: 48.1, lng: 11.5, mileage: 42000 },
      { time: depart, lat: 48.25, lng: 11.65, mileage: 42045 },
      { time: enRoute, lat: 48.25, lng: 11.65, mileage: 42045 },
      { time: arrive, lat: 48.25, lng: 11.65, mileage: 42045 }
    ]);
    series[FUEL_KEY] = [
      { time: parked, value: 80 },
      { time: arrive, value: 72 }
    ];

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

  it("deprecated Tür-Erkennung bleibt für Tests verfügbar", () => {
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

  it("exportiert sinnvolle Defaults", () => {
    expect(BMW_DEFAULT_TANK_CAPACITY_LITERS).toBe(60);
    expect(BMW_TRIP_STATUS_SILENCE_MS).toBe(30 * 60 * 1000);
  });
});
