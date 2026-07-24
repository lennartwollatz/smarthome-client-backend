import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOpenRouteServiceCacheForTests,
  fetchRouteGeometryForPoints,
  simplifyRoutePoints
} from "../openRouteServiceClient.js";

describe("openRouteServiceClient", () => {
  beforeEach(() => {
    clearOpenRouteServiceCacheForTests();
    vi.unstubAllGlobals();
    delete process.env.ORS_API_KEY;
    delete process.env.OPENROUTESERVICE_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ORS_API_KEY;
    delete process.env.OPENROUTESERVICE_API_KEY;
  });

  it("simplifyRoutePoints behält Start und Ende und reduziert Zwischenpunkte", () => {
    const points = Array.from({ length: 120 }, (_, i) => ({
      lat: 48.1 + i * 0.001,
      lng: 11.5 + i * 0.001
    }));

    const simplified = simplifyRoutePoints(points, 50);
    expect(simplified.length).toBeLessThanOrEqual(50);
    expect(simplified[0]).toEqual(points[0]);
    expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
  });

  it("liefert null ohne API-Key", async () => {
    const geometry = await fetchRouteGeometryForPoints([
      { lat: 48.1, lng: 11.5 },
      { lat: 48.2, lng: 11.6 }
    ]);
    expect(geometry).toBeNull();
  });

  it("holt Route-Geometrie von OpenRouteService", async () => {
    process.env.ORS_API_KEY = "test-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: "FeatureCollection",
        features: [
          {
            geometry: {
              type: "LineString",
              coordinates: [
                [11.5, 48.1],
                [11.55, 48.15],
                [11.6, 48.2]
              ]
            }
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const geometry = await fetchRouteGeometryForPoints([
      { lat: 48.1, lng: 11.5 },
      { lat: 48.15, lng: 11.55 },
      { lat: 48.2, lng: 11.6 }
    ]);

    expect(geometry).toEqual({
      type: "LineString",
      coordinates: [
        [11.5, 48.1],
        [11.55, 48.15],
        [11.6, 48.2]
      ]
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.headers?.Authorization).toBe("test-key");
  });

  it("nutzt den Antwort-Cache für identische Punktfolgen", async () => {
    process.env.ORS_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [{ geometry: { type: "LineString", coordinates: [[11.5, 48.1], [11.6, 48.2]] } }]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const points = [
      { lat: 48.1, lng: 11.5 },
      { lat: 48.2, lng: 11.6 }
    ];
    await fetchRouteGeometryForPoints(points);
    await fetchRouteGeometryForPoints(points);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
