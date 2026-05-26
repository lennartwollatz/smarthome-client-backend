import { describe, expect, it } from "vitest";
import {
  BMW_DRIVER_DOOR_KEY,
  BMW_MIN_TRIP_DISTANCE_KM,
  buildLocationTrack,
  buildTripFromInterval,
  collectDriverDoorCloseEvents,
  detectTripIntervalsFromDoorEvents,
  detectTripsFromHistorySeries,
  detectTripsFromTrack,
  type BmwCarTripPoint
} from "../bmwCarTripDetector.js";

const MILEAGE_KEY = "vehicle.vehicle.travelledDistance";
const LAT_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.latitude";
const LNG_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.longitude";

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

  it("collectDriverDoorCloseEvents erkennt nur true → false Übergänge", () => {
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
    const events = collectDriverDoorCloseEvents(series);
    expect(events.map(e => e.time)).toEqual([t + 5_000, t + 15_000]);
  });

  it("erkennt Trip-Ende bei Tür-zu mit Strecke > 1 km", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const t1 = Date.UTC(2026, 4, 15, 8, 0, 0);
    const t2 = Date.UTC(2026, 4, 15, 8, 30, 0);

    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: t1 - 1000, value: true },
        { time: t1, value: false },
        { time: t2 - 1000, value: true },
        { time: t2, value: false }
      ],
      [MILEAGE_KEY]: [
        { time: t1, value: 42000 },
        { time: t2, value: 42020 }
      ]
    };
    const intervals = detectTripIntervalsFromDoorEvents(series, fromMs, toMs);
    expect(intervals.length).toBe(1);
    expect(intervals[0].startTime).toBe(t1);
    expect(intervals[0].endTime).toBe(t2);
  });

  it("ignoriert Tür-zu-Events unter 1 km (kurzes Aussteigen)", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const t1 = Date.UTC(2026, 4, 15, 8, 0, 0);
    const t2 = Date.UTC(2026, 4, 15, 8, 5, 0);
    const t3 = Date.UTC(2026, 4, 15, 8, 35, 0);

    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: t1 - 1000, value: true },
        { time: t1, value: false },
        { time: t2 - 1000, value: true },
        { time: t2, value: false },
        { time: t3 - 1000, value: true },
        { time: t3, value: false }
      ],
      [MILEAGE_KEY]: [
        { time: t1, value: 42000 },
        { time: t2, value: 42000.4 },
        { time: t3, value: 42025 }
      ]
    };
    const intervals = detectTripIntervalsFromDoorEvents(series, fromMs, toMs);
    expect(intervals.length).toBe(1);
    expect(intervals[0].startTime).toBe(t1);
    expect(intervals[0].endTime).toBe(t3);
  });

  it("erkennt mehrere Fahrten an verschiedenen Tagen", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const t1Start = Date.UTC(2026, 4, 15, 8, 0, 0);
    const t1End = Date.UTC(2026, 4, 15, 8, 25, 0);
    const t2Start = Date.UTC(2026, 4, 15, 16, 30, 0);
    const t2End = Date.UTC(2026, 4, 15, 17, 0, 0);

    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: t1Start - 1000, value: true },
        { time: t1Start, value: false },
        { time: t1End - 1000, value: true },
        { time: t1End, value: false },
        { time: t2Start - 1000, value: true },
        { time: t2Start, value: false },
        { time: t2End - 1000, value: true },
        { time: t2End, value: false }
      ],
      [MILEAGE_KEY]: [
        { time: t1Start, value: 42000 },
        { time: t1End, value: 42020 },
        { time: t2Start, value: 42020 },
        { time: t2End, value: 42045 }
      ]
    };
    const intervals = detectTripIntervalsFromDoorEvents(series, fromMs, toMs);
    expect(intervals.length).toBe(2);
    expect(intervals[0].startTime).toBe(t1Start);
    expect(intervals[0].endTime).toBe(t1End);
    expect(intervals[1].startTime).toBe(t2Start);
    expect(intervals[1].endTime).toBe(t2End);
  });

  it("liefert keine Fahrt ohne Tür-Events", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const intervals = detectTripIntervalsFromDoorEvents({}, fromMs, toMs);
    expect(intervals).toEqual([]);
  });

  it("liefert keine Fahrt ohne Tachostand-Daten (Distanz unbekannt)", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const t1 = Date.UTC(2026, 4, 15, 8, 0, 0);
    const t2 = Date.UTC(2026, 4, 15, 8, 30, 0);
    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: t1 - 1000, value: true },
        { time: t1, value: false },
        { time: t2 - 1000, value: true },
        { time: t2, value: false }
      ]
    };
    const intervals = detectTripIntervalsFromDoorEvents(series, fromMs, toMs);
    expect(intervals).toEqual([]);
  });

  it("kappt Trip-Start auf fromMs, wenn Anker vor dem Zeitraum liegt", () => {
    const t1 = Date.UTC(2026, 4, 15, 7, 0, 0);
    const t2 = Date.UTC(2026, 4, 15, 9, 0, 0);
    const fromMs = Date.UTC(2026, 4, 15, 8, 0, 0);
    const toMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: t1 - 1000, value: true },
        { time: t1, value: false },
        { time: t2 - 1000, value: true },
        { time: t2, value: false }
      ],
      [MILEAGE_KEY]: [
        { time: t1, value: 42000 },
        { time: t2, value: 42050 }
      ]
    };
    const intervals = detectTripIntervalsFromDoorEvents(series, fromMs, toMs);
    expect(intervals.length).toBe(1);
    expect(intervals[0].startTime).toBe(fromMs);
    expect(intervals[0].endTime).toBe(t2);
  });

  it("verwendet konfigurierbare Distanz-Schwelle", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const t1 = Date.UTC(2026, 4, 15, 8, 0, 0);
    const t2 = Date.UTC(2026, 4, 15, 8, 30, 0);
    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: t1 - 1000, value: true },
        { time: t1, value: false },
        { time: t2 - 1000, value: true },
        { time: t2, value: false }
      ],
      [MILEAGE_KEY]: [
        { time: t1, value: 42000 },
        { time: t2, value: 42000.7 }
      ]
    };
    expect(detectTripIntervalsFromDoorEvents(series, fromMs, toMs).length).toBe(0);
    expect(detectTripIntervalsFromDoorEvents(series, fromMs, toMs, 0.5).length).toBe(1);
  });

  it("Default-Schwelle ist 1 km", () => {
    expect(BMW_MIN_TRIP_DISTANCE_KM).toBe(1);
  });

  it("detectTripsFromHistorySeries kombiniert Türschluss-Events mit GPS und Tacho", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const t1 = Date.UTC(2026, 4, 15, 8, 0, 0);
    const t2 = Date.UTC(2026, 4, 15, 8, 25, 0);
    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: t1 - 1000, value: true },
        { time: t1, value: false },
        { time: t2 - 1000, value: true },
        { time: t2, value: false }
      ],
      [MILEAGE_KEY]: [
        { time: t1, value: 42000 },
        { time: t2, value: 42020 }
      ],
      [LAT_KEY]: [
        { time: t1, value: 48.1 },
        { time: t2, value: 48.15 }
      ],
      [LNG_KEY]: [
        { time: t1, value: 11.5 },
        { time: t2, value: 11.6 }
      ]
    };
    const trips = detectTripsFromHistorySeries(series, fromMs, toMs);
    expect(trips.length).toBe(1);
    expect(trips[0].startTime).toBe(t1);
    expect(trips[0].endTime).toBe(t2);
    expect(trips[0].mileageDrivenKm).toBe(20);
    expect(trips[0].distanceKm).toBe(20);
  });

  it("liefert Fahrt ohne GPS mit Dauer aus Intervall", () => {
    const start = Date.UTC(2026, 4, 15, 8, 0, 0);
    const end = Date.UTC(2026, 4, 15, 8, 15, 0);
    const trip = buildTripFromInterval({ startTime: start, endTime: end }, []);
    expect(trip.distanceKm).toBe(0);
    expect(trip.durationMin).toBe(15);
    expect(trip.durationHours).toBe(0);
    expect(trip.durationMinutes).toBe(15);
    expect(trip.points.length).toBe(0);
  });

  it("berechnet Kilometerstand, Tank und Verbrauch aus Historie", () => {
    const start = Date.UTC(2026, 4, 15, 8, 0, 0);
    const end = Date.UTC(2026, 4, 15, 9, 0, 0);
    const trip = buildTripFromInterval(
      { startTime: start, endTime: end },
      [
        { time: start, lat: 48.1, lng: 11.5 },
        { time: end, lat: 48.2, lng: 11.6 }
      ],
      {
        mileageSeries: [
          { time: start - 1000, value: 42000 },
          { time: end, value: 42045 }
        ],
        fuelSeries: [
          { time: start, value: 80 },
          { time: end, value: 72 }
        ]
      }
    );
    expect(trip.mileageKmBefore).toBe(42000);
    expect(trip.mileageKmAfter).toBe(42045);
    expect(trip.mileageDrivenKm).toBe(45);
    expect(trip.fuelPercentBefore).toBe(80);
    expect(trip.fuelPercentAfter).toBe(72);
    expect(trip.fuelConsumptionPer100Km).toBeCloseTo(17.8, 0);
    expect(trip.durationHours).toBe(1);
    expect(trip.durationMinutes).toBe(0);
  });
});
