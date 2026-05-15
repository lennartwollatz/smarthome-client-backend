import { describe, expect, it } from "vitest";
import {
  buildLocationTrack,
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

  it("trennt Fahrten bei großer Zeitlücke", () => {
    const base = Date.UTC(2026, 4, 15, 8, 0, 0);
    const track: BmwCarTripPoint[] = [
      { time: base, lat: 48.1, lng: 11.5 },
      { time: base + 10 * 60_000, lat: 48.11, lng: 11.51 },
      { time: base + 60 * 60_000, lat: 48.2, lng: 11.6 },
      { time: base + 70 * 60_000, lat: 48.21, lng: 11.61 }
    ];
    const trips = detectTripsFromTrack(track);
    expect(trips.length).toBe(2);
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
});
