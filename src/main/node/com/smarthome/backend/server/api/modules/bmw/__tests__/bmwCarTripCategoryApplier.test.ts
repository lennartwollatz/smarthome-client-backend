import { describe, expect, it } from "vitest";
import { applyTripCategoriesToEntries } from "../bmwCarTripCategoryApplier.js";
import type { BmwCarTripEntry } from "../bmwCarTripGrouper.js";

function entry(id: string, grouped: boolean, segmentIds: string[]): BmwCarTripEntry {
  return {
    id,
    grouped,
    autoGrouped: grouped,
    startTime: 0,
    endTime: 1,
    distanceKm: 10,
    durationMin: 1,
    durationHours: 0,
    durationMinutes: 1,
    start: { lat: 0, lng: 0 },
    end: { lat: 0, lng: 0 },
    points: [],
    segmentMarkers: [],
    segments: segmentIds.map(sid => ({
      id: sid,
      startTime: 0,
      endTime: 1,
      distanceKm: 5,
      durationMin: 1,
      durationHours: 0,
      durationMinutes: 1,
      start: { lat: 0, lng: 0 },
      end: { lat: 0, lng: 0 },
      points: []
    }))
  };
}

describe("bmwCarTripCategoryApplier", () => {
  it("setzt Kategorie auf Einzelfahrt", () => {
    const [e] = applyTripCategoriesToEntries([entry("trip-1", false, ["trip-1"])], {
      "trip-1": "business"
    });
    expect(e.tripCategory).toBe("business");
  });

  it("leitet einheitliche Segment-Kategorien auf Gruppe ab", () => {
    const [e] = applyTripCategoriesToEntries([entry("group-1", true, ["a", "b"])], {
      a: "private",
      b: "private"
    });
    expect(e.tripCategory).toBe("private");
  });
});
