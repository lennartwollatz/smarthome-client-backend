import { describe, expect, it } from "vitest";
import {
  buildLocationTrack,
  buildTripFromInterval,
  detectInUseIntervals,
  detectTripsFromHistorySeries,
  detectTripsFromTrack,
  type BmwCarTripPoint
} from "../bmwCarTripDetector.js";

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
      "vehicle.cabin.infotainment.navigation.currentLocation.latitude": [
        { time: t, value: 48.1 },
        { time: t + 60_000, value: 48.2 }
      ],
      "vehicle.cabin.infotainment.navigation.currentLocation.longitude": [
        { time: t, value: 11.5 },
        { time: t + 60_000, value: 11.6 }
      ]
    };
    const track = buildLocationTrack(series);
    expect(track.length).toBeGreaterThanOrEqual(2);
  });

  it("erkennt Fahrt von Motor-an bis Motor-aus (In Benutzung)", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const start = Date.UTC(2026, 4, 15, 8, 0, 0);
    const end = Date.UTC(2026, 4, 15, 8, 25, 0);
    const toMs = Date.UTC(2026, 4, 30, 0, 0, 0);

    const series = {
      "vehicle.status.car.inUse": [
        { time: start, value: true },
        { time: end, value: false }
      ],
      "vehicle.cabin.infotainment.navigation.currentLocation.latitude": [
        { time: start, value: 48.1 },
        { time: start + 10 * 60_000, value: 48.15 }
      ],
      "vehicle.cabin.infotainment.navigation.currentLocation.longitude": [
        { time: start, value: 11.5 },
        { time: start + 10 * 60_000, value: 11.6 }
      ]
    };

    const trips = detectTripsFromHistorySeries(series, fromMs, toMs);
    expect(trips.length).toBe(1);
    expect(trips[0].startTime).toBe(start);
    expect(trips[0].endTime).toBe(end);
    expect(trips[0].durationMin).toBe(25);
    expect(trips[0].distanceKm).toBeGreaterThan(0);
  });

  it("trennt mehrere Fahrten bei erneutem Motor-an", () => {
    const fromMs = Date.UTC(2026, 4, 1, 0, 0, 0);
    const toMs = Date.UTC(2026, 4, 30, 0, 0, 0);
    const t1Start = Date.UTC(2026, 4, 15, 8, 0, 0);
    const t1End = Date.UTC(2026, 4, 15, 8, 20, 0);
    const t2Start = Date.UTC(2026, 4, 15, 10, 0, 0);
    const t2End = Date.UTC(2026, 4, 15, 10, 30, 0);

    const series = {
      "vehicle.status.car.inUse": [
        { time: t1Start, value: true },
        { time: t1End, value: false },
        { time: t2Start, value: true },
        { time: t2End, value: false }
      ]
    };

    const intervals = detectInUseIntervals(series, fromMs, toMs);
    expect(intervals.length).toBe(2);
    expect(intervals[0].startTime).toBe(t1Start);
    expect(intervals[1].startTime).toBe(t2Start);
  });

  it("setzt Fahrtbeginn auf fromMs wenn Motor schon vor dem Zeitraum an war", () => {
    const fromMs = Date.UTC(2026, 4, 15, 8, 0, 0);
    const toMs = Date.UTC(2026, 4, 15, 12, 0, 0);
    const series = {
      "vehicle.status.car.inUse": [
        { time: Date.UTC(2026, 4, 15, 7, 0, 0), value: true },
        { time: Date.UTC(2026, 4, 15, 9, 0, 0), value: false }
      ]
    };

    const intervals = detectInUseIntervals(series, fromMs, toMs);
    expect(intervals.length).toBe(1);
    expect(intervals[0].startTime).toBe(fromMs);
    expect(intervals[0].endTime).toBe(Date.UTC(2026, 4, 15, 9, 0, 0));
  });

  it("liefert Fahrt ohne GPS mit Dauer aus In-Benutzung-Intervall", () => {
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
