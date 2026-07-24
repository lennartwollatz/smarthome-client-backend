import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearOpenRouteServiceCacheForTests } from "../../../../geo/openRouteServiceClient.js";
import { enrichEntryWithRoute } from "../bmwCarTripRouteEnricher.js";
import type { BmwCarTripEntry } from "../bmwCarTripGrouper.js";

describe("bmwCarTripRouteEnricher", () => {
  beforeEach(() => {
    clearOpenRouteServiceCacheForTests();
    vi.unstubAllGlobals();
    delete process.env.ORS_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ORS_API_KEY;
  });

  it("reichert Entry und Segmente mit Route an", async () => {
    process.env.ORS_API_KEY = "test-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              geometry: {
                type: "LineString",
                coordinates: [
                  [11.5, 48.1],
                  [11.6, 48.2]
                ]
              }
            }
          ]
        })
      })
    );

    const entry: BmwCarTripEntry = {
      id: "trip-1",
      grouped: false,
      autoGrouped: false,
      startTime: 1,
      endTime: 2,
      distanceKm: 10,
      durationMin: 10,
      durationHours: 0,
      durationMinutes: 10,
      start: { lat: 48.1, lng: 11.5 },
      end: { lat: 48.2, lng: 11.6 },
      points: [
        { time: 1, lat: 48.1, lng: 11.5 },
        { time: 2, lat: 48.2, lng: 11.6 }
      ],
      segmentMarkers: [],
      segments: [
        {
          id: "trip-1",
          startTime: 1,
          endTime: 2,
          distanceKm: 10,
          durationMin: 10,
          durationHours: 0,
          durationMinutes: 10,
          start: { lat: 48.1, lng: 11.5 },
          end: { lat: 48.2, lng: 11.6 },
          points: [
            { time: 1, lat: 48.1, lng: 11.5 },
            { time: 2, lat: 48.2, lng: 11.6 }
          ]
        }
      ]
    };

    const enriched = await enrichEntryWithRoute(entry);
    expect(enriched.route).toEqual({
      type: "LineString",
      coordinates: [
        [11.5, 48.1],
        [11.6, 48.2]
      ]
    });
    expect(enriched.segments[0].route).toEqual(enriched.route);
  });
});
