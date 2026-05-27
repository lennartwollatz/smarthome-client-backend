import { describe, expect, it } from "vitest";
import {
  BMW_DEFAULT_TANK_CAPACITY_LITERS,
  BMW_DRIVER_DOOR_KEY,
  BMW_TRIP_STATIONARY_PAUSE_MS,
  buildLocationTrack,
  buildTripFromInterval,
  collectDriverDoorOpenEvents,
  computeDrivenKmBetween,
  detectTripIntervalsFromDoorOpenEvents,
  detectTripsFromHistorySeries,
  detectTripsFromTrack,
  findStationaryPauseEnd,
  type BmwCarTripPoint
} from "../bmwCarTripDetector.js";

const MILEAGE_KEY = "vehicle.vehicle.travelledDistance";
const RANGE_KEY = "vehicle.drivetrain.lastRemainingRange";
const FUEL_KEY = "vehicle.drivetrain.fuelSystem.level";
const LAT_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.latitude";
const LNG_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.longitude";

const STATIONARY_MS = BMW_TRIP_STATIONARY_PAUSE_MS;

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

  it("collectDriverDoorOpenEvents zählt ersten beobachteten true-Zustand", () => {
    const t = Date.UTC(2026, 4, 15, 8, 0, 0);
    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: t, value: true },
        { time: t + 1_000, value: false }
      ]
    };
    expect(collectDriverDoorOpenEvents(series).map(e => e.time)).toEqual([t]);
  });

  it("findStationaryPauseEnd liefert den ersten Punkt der ≥5-Minuten-Stillstandsphase", () => {
    const base = Date.UTC(2026, 4, 15, 9, 0, 0);
    // Bewegung bis 10:00, dann 10:00–10:08 statisch am selben Ort
    const track: BmwCarTripPoint[] = [
      { time: base, lat: 48.1, lng: 11.5 },
      { time: base + 30 * 60_000, lat: 48.2, lng: 11.6 },
      { time: base + 60 * 60_000, lat: 48.25, lng: 11.65 },
      { time: base + 61 * 60_000, lat: 48.25001, lng: 11.65001 },
      { time: base + 66 * 60_000, lat: 48.25001, lng: 11.65001 },
      { time: base + 68 * 60_000, lat: 48.25001, lng: 11.65001 }
    ];
    const end = findStationaryPauseEnd(track, base, base + 90 * 60_000);
    expect(end).toBe(base + 60 * 60_000);
  });

  it("findStationaryPauseEnd liefert undefined, wenn das Auto in Bewegung bleibt", () => {
    const base = Date.UTC(2026, 4, 15, 9, 0, 0);
    const track: BmwCarTripPoint[] = [
      { time: base, lat: 48.1, lng: 11.5 },
      { time: base + 2 * 60_000, lat: 48.11, lng: 11.51 },
      { time: base + 4 * 60_000, lat: 48.12, lng: 11.52 },
      { time: base + 6 * 60_000, lat: 48.13, lng: 11.53 },
      { time: base + 8 * 60_000, lat: 48.14, lng: 11.54 }
    ];
    expect(findStationaryPauseEnd(track, base, base + 30 * 60_000)).toBeUndefined();
  });

  it("Trip endet am nächsten Tür-Auf-Event (nicht an kurzer GPS-Pause)", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const t1Open = Date.UTC(2026, 4, 15, 8, 0, 0);
    const t2Open = Date.UTC(2026, 4, 15, 9, 0, 0);
    const briefStop = t1Open + 10 * 60_000;

    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: t1Open - 1_000, value: false },
        { time: t1Open, value: true },
        { time: t1Open + 1_000, value: false },
        { time: t2Open - 1_000, value: false },
        { time: t2Open, value: true }
      ],
      [RANGE_KEY]: [
        { time: t1Open, value: 340 },
        { time: t2Open, value: 320 }
      ],
      [LAT_KEY]: [
        { time: t1Open, value: 48.1 },
        { time: briefStop, value: 48.15 },
        { time: briefStop + 3 * 60_000, value: 48.15 },
        { time: t2Open, value: 48.25 }
      ],
      [LNG_KEY]: [
        { time: t1Open, value: 11.5 },
        { time: briefStop, value: 11.55 },
        { time: briefStop + 3 * 60_000, value: 11.55 },
        { time: t2Open, value: 11.65 }
      ]
    };

    const intervals = detectTripIntervalsFromDoorOpenEvents(series, fromMs, toMs);
    expect(intervals.length).toBe(1);
    expect(intervals[0].startTime).toBe(t1Open);
    expect(intervals[0].endTime).toBe(t2Open);
  });

  it("erkennt Fahrt trotz unverändertem Tacho wenn GPS/Restreichweite Bewegung zeigen", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const t1 = Date.UTC(2026, 4, 26, 7, 5, 0);
    const t2 = Date.UTC(2026, 4, 26, 7, 51, 0);

    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: t1 - 1, value: false },
        { time: t1, value: true },
        { time: t2 - 1, value: false },
        { time: t2, value: true }
      ],
      [MILEAGE_KEY]: [
        { time: t1, value: 42000 },
        { time: t2, value: 42000 }
      ],
      [RANGE_KEY]: [
        { time: t1, value: 335 },
        { time: t2, value: 310 }
      ],
      [LAT_KEY]: [
        { time: t1, value: 53.5812 },
        { time: t1 + 20 * 60_000, value: 53.65 },
        { time: t2, value: 53.7999 }
      ],
      [LNG_KEY]: [
        { time: t1, value: 9.9669 },
        { time: t1 + 20 * 60_000, value: 10.1 },
        { time: t2, value: 10.3433 }
      ]
    };

    const intervals = detectTripIntervalsFromDoorOpenEvents(series, fromMs, toMs);
    expect(intervals.length).toBe(1);
    expect(intervals[0].startTime).toBe(t1);
    expect(intervals[0].endTime).toBe(t2);

    const track = buildLocationTrack(series);
    const driven = computeDrivenKmBetween(
      series[MILEAGE_KEY],
      series[RANGE_KEY],
      track,
      t1,
      t2
    );
    expect(driven).toBeGreaterThan(0.3);
  });

  it("erkennt mehrere Fahrten zwischen aufeinanderfolgenden Tür-Auf-Events", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const t1Open = Date.UTC(2026, 4, 15, 8, 0, 0);
    const t1End = t1Open + 20 * 60_000;
    const t2Open = Date.UTC(2026, 4, 15, 16, 0, 0);
    const t2End = t2Open + 30 * 60_000;

    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: t1Open - 1, value: false },
        { time: t1Open, value: true },
        { time: t1Open + 1_000, value: false },
        { time: t2Open - 1, value: false },
        { time: t2Open, value: true },
        { time: t2Open + 1_000, value: false }
      ],
      [RANGE_KEY]: [
        { time: t1Open, value: 340 },
        { time: t1End, value: 320 },
        { time: t2Open, value: 320 },
        { time: t2End, value: 300 }
      ],
      [LAT_KEY]: [
        { time: t1Open, value: 48.1 },
        { time: t1End, value: 48.2 },
        { time: t2Open, value: 48.2 },
        { time: t2End, value: 48.3 }
      ],
      [LNG_KEY]: [
        { time: t1Open, value: 11.5 },
        { time: t1End, value: 11.55 },
        { time: t2Open, value: 11.55 },
        { time: t2End, value: 11.6 }
      ]
    };

    const intervals = detectTripIntervalsFromDoorOpenEvents(series, fromMs, toMs);
    expect(intervals.length).toBe(2);
    expect(intervals[0]).toEqual({ startTime: t1Open, endTime: t2Open });
    expect(intervals[1].startTime).toBe(t2Open);
    expect(intervals[1].endTime).toBe(toMs);
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

  it("ohne GPS-Daten endet der Trip am nächsten Tür-Auf bzw. an toMs", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const t1 = Date.UTC(2026, 4, 15, 8, 0, 0);
    const t2 = Date.UTC(2026, 4, 15, 9, 0, 0);
    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: t1 - 1, value: false },
        { time: t1, value: true },
        { time: t1 + 1_000, value: false },
        { time: t2 - 1, value: false },
        { time: t2, value: true }
      ]
    };
    const intervals = detectTripIntervalsFromDoorOpenEvents(series, fromMs, toMs);
    expect(intervals.length).toBe(2);
    expect(intervals[0]).toEqual({ startTime: t1, endTime: t2 });
    expect(intervals[1]).toEqual({ startTime: t2, endTime: toMs });
  });

  it("klippt Trip-Starts ausserhalb [fromMs, toMs]", () => {
    const fromMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const toMs = Date.UTC(2026, 4, 15, 14, 0, 0);
    const before = Date.UTC(2026, 4, 15, 11, 0, 0);
    const inside = Date.UTC(2026, 4, 15, 12, 30, 0);
    const after = Date.UTC(2026, 4, 15, 15, 0, 0);
    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: before - 1, value: false },
        { time: before, value: true },
        { time: before + 1, value: false },
        { time: inside - 1, value: false },
        { time: inside, value: true },
        { time: inside + 1, value: false },
        { time: after - 1, value: false },
        { time: after, value: true }
      ]
    };
    const intervals = detectTripIntervalsFromDoorOpenEvents(series, fromMs, toMs);
    expect(intervals.map(i => i.startTime)).toEqual([inside]);
  });

  it("detectTripsFromHistorySeries kombiniert Türöffnung mit GPS, Tachostand und Tankgröße", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const tOpen = Date.UTC(2026, 4, 15, 8, 0, 0);
    const tArrive = tOpen + 60 * 60_000;
    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: tOpen - 1, value: false },
        { time: tOpen, value: true },
        { time: tOpen + 1_000, value: false },
        { time: tArrive - 1, value: false },
        { time: tArrive, value: true }
      ],
      [MILEAGE_KEY]: [
        { time: tOpen, value: 42000 },
        { time: tArrive, value: 42045 }
      ],
      [RANGE_KEY]: [
        { time: tOpen, value: 400 },
        { time: tArrive, value: 355 }
      ],
      [FUEL_KEY]: [
        { time: tOpen, value: 80 },
        { time: tArrive, value: 72 }
      ],
      [LAT_KEY]: [
        { time: tOpen, value: 48.1 },
        { time: tArrive, value: 48.25 }
      ],
      [LNG_KEY]: [
        { time: tOpen, value: 11.5 },
        { time: tArrive, value: 11.65 }
      ]
    };
    const trips = detectTripsFromHistorySeries(series, fromMs, toMs, {
      tankCapacityLiters: 60
    });
    expect(trips.length).toBe(1);
    expect(trips[0].startTime).toBe(tOpen);
    expect(trips[0].endTime).toBe(tArrive);
    expect(trips[0].mileageDrivenKm).toBe(45);
    expect(trips[0].fuelPercentBefore).toBe(80);
    expect(trips[0].fuelPercentAfter).toBe(72);
    expect(trips[0].fuelUsedLiters).toBe(4.8);
    expect(trips[0].fuelConsumptionPer100Km).toBeCloseTo(10.7, 1);
    expect(trips[0].tankCapacityLiters).toBe(60);
  });

  it("liefert Fahrt ohne GPS mit Dauer aus Intervall", () => {
    const start = Date.UTC(2026, 4, 15, 8, 0, 0);
    const end = Date.UTC(2026, 4, 15, 8, 15, 0);
    const trip = buildTripFromInterval({ startTime: start, endTime: end }, []);
    expect(trip.distanceKm).toBe(0);
    expect(trip.durationMin).toBe(15);
    expect(trip.points.length).toBe(0);
  });

  it("berechnet Verbrauch in L/100 km und Litern aus Tankgröße", () => {
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
        ],
        tankCapacityLiters: 60
      }
    );
    expect(trip.mileageDrivenKm).toBe(45);
    expect(trip.fuelPercentBefore).toBe(80);
    expect(trip.fuelPercentAfter).toBe(72);
    // 8% von 60L = 4.8L verbraucht
    expect(trip.fuelUsedLiters).toBe(4.8);
    // 4.8L / 45km = 10.67 L/100km
    expect(trip.fuelConsumptionPer100Km).toBeCloseTo(10.7, 1);
    expect(trip.tankCapacityLiters).toBe(60);
  });

  it("ohne Tankgröße bleibt der Liter-Verbrauch undefiniert", () => {
    const start = Date.UTC(2026, 4, 15, 8, 0, 0);
    const end = Date.UTC(2026, 4, 15, 9, 0, 0);
    const trip = buildTripFromInterval(
      { startTime: start, endTime: end },
      [],
      {
        mileageSeries: [
          { time: start, value: 1000 },
          { time: end, value: 1050 }
        ],
        fuelSeries: [
          { time: start, value: 80 },
          { time: end, value: 70 }
        ]
      }
    );
    expect(trip.fuelUsedLiters).toBeUndefined();
    expect(trip.fuelConsumptionPer100Km).toBeUndefined();
    expect(trip.tankCapacityLiters).toBeUndefined();
  });

  it("exportiert sinnvolle Defaults", () => {
    expect(BMW_DEFAULT_TANK_CAPACITY_LITERS).toBe(60);
    expect(BMW_TRIP_STATIONARY_PAUSE_MS).toBe(5 * 60 * 1000);
  });

  it("Tür-Auf am Ziel beendet den Trip und startet keinen Geister-Trip", () => {
    // Szenario: Fahrer öffnet morgens die Tür (Losfahren) → fährt → am Ziel öffnet
    // er erneut die Tür (Aussteigen). Dieser zweite Tür-Auf darf KEINEN neuen
    // (Mini-)Trip auslösen, weil das Auto sich danach nicht mehr bewegt.
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const tStart = Date.UTC(2026, 4, 15, 8, 0, 0); // Tür auf am Start
    const tEnd = tStart + 60 * 60_000; // Tür auf am Ziel

    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: tStart - 1, value: false },
        { time: tStart, value: true },
        { time: tStart + 1_000, value: false },
        { time: tEnd - 1, value: false },
        { time: tEnd, value: true },
        { time: tEnd + 1_000, value: false }
      ],
      [MILEAGE_KEY]: [
        { time: tStart, value: 42000 },
        { time: tEnd, value: 42050 },
        { time: tEnd + STATIONARY_MS, value: 42050 }
      ],
      [LAT_KEY]: [
        { time: tStart, value: 48.1 },
        { time: tEnd, value: 48.25 },
        { time: tEnd + STATIONARY_MS, value: 48.25 }
      ],
      [LNG_KEY]: [
        { time: tStart, value: 11.5 },
        { time: tEnd, value: 11.65 },
        { time: tEnd + STATIONARY_MS, value: 11.65 }
      ]
    };

    const intervals = detectTripIntervalsFromDoorOpenEvents(series, fromMs, toMs);
    expect(intervals.length).toBe(1);
    expect(intervals[0].startTime).toBe(tStart);
    expect(intervals[0].endTime).toBe(tEnd);
  });

  it("Tankstopp >5 Min ohne Bewegung erzeugt zwei Trips, kein Phantom-Trip dazwischen", () => {
    // Szenario: 8:00 Losfahren → 8:30 Tankstelle (Tür auf) → 8:38 weiter (Tür auf) → 9:00 Ziel (Tür auf).
    // Zwischen 8:30 und 8:38 keine Fahrt – darf KEINEN Trip erzeugen.
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const t0 = Date.UTC(2026, 4, 15, 8, 0, 0);
    const tGasOut = t0 + 30 * 60_000; // 8:30
    const tGasIn = t0 + 38 * 60_000; // 8:38
    const tArrive = t0 + 60 * 60_000; // 9:00

    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: t0 - 1, value: false },
        { time: t0, value: true },
        { time: t0 + 1_000, value: false },
        { time: tGasOut - 1, value: false },
        { time: tGasOut, value: true },
        { time: tGasOut + 1_000, value: false },
        { time: tGasIn - 1, value: false },
        { time: tGasIn, value: true },
        { time: tGasIn + 1_000, value: false },
        { time: tArrive - 1, value: false },
        { time: tArrive, value: true },
        { time: tArrive + 1_000, value: false }
      ],
      [MILEAGE_KEY]: [
        { time: t0, value: 42000 },
        { time: tGasOut, value: 42020 },
        { time: tGasIn, value: 42020 },
        { time: tArrive, value: 42050 },
        { time: tArrive + STATIONARY_MS, value: 42050 }
      ],
      [LAT_KEY]: [
        { time: t0, value: 48.1 },
        { time: tGasOut, value: 48.18 },
        { time: tGasIn, value: 48.18 },
        { time: tArrive, value: 48.28 },
        { time: tArrive + STATIONARY_MS, value: 48.28 }
      ],
      [LNG_KEY]: [
        { time: t0, value: 11.5 },
        { time: tGasOut, value: 11.58 },
        { time: tGasIn, value: 11.58 },
        { time: tArrive, value: 11.68 },
        { time: tArrive + STATIONARY_MS, value: 11.68 }
      ]
    };

    const intervals = detectTripIntervalsFromDoorOpenEvents(series, fromMs, toMs);
    expect(intervals.length).toBe(2);
    expect(intervals[0]).toEqual({ startTime: t0, endTime: tGasOut });
    expect(intervals[1]).toEqual({ startTime: tGasIn, endTime: tArrive });
  });

  it("Tür-Auf ohne Bewegung erzeugt keinen Trip zwischen den Events", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 23, 59, 0);
    const t1 = Date.UTC(2026, 4, 15, 8, 0, 0);
    const t2 = t1 + 10 * 60_000;

    const series = {
      [BMW_DRIVER_DOOR_KEY]: [
        { time: t1 - 1, value: false },
        { time: t1, value: true },
        { time: t1 + 1_000, value: false },
        { time: t2 - 1, value: false },
        { time: t2, value: true },
        { time: t2 + 1_000, value: false }
      ],
      [MILEAGE_KEY]: [
        { time: t1, value: 42000 },
        { time: t2, value: 42000 },
        { time: t2 + STATIONARY_MS, value: 42000 }
      ],
      [LAT_KEY]: [
        { time: t1, value: 48.1 },
        { time: t2, value: 48.1 },
        { time: t2 + STATIONARY_MS, value: 48.1 }
      ],
      [LNG_KEY]: [
        { time: t1, value: 11.5 },
        { time: t2, value: 11.5 },
        { time: t2 + STATIONARY_MS, value: 11.5 }
      ]
    };

    const intervals = detectTripIntervalsFromDoorOpenEvents(series, fromMs, toMs);
    expect(intervals.length).toBe(0);
  });
});
