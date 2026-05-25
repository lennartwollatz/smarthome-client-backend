import { describe, expect, it } from "vitest";
import {
  autoCategorizeTripEntries,
  isAtHome,
  learnableEndpoints,
  observationsFromCategorizedEntry
} from "../bmwCarTripAutoCategorizer.js";
import type { BmwCarTripEntry } from "../bmwCarTripGrouper.js";
import type { BmwCarHome } from "../bmwCarHomeStore.js";
import type { BmwLearnedPlace } from "../bmwCarLearnedPlacesStore.js";

const HOME: BmwCarHome = {
  latitude: 48.1,
  longitude: 11.5,
  updatedAt: new Date().toISOString()
};

function entry(
  id: string,
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  segments: string[] = [id]
): BmwCarTripEntry {
  return {
    id,
    grouped: segments.length > 1,
    autoGrouped: segments.length > 1,
    startTime: 0,
    endTime: 1,
    distanceKm: 10,
    durationMin: 30,
    durationHours: 0,
    durationMinutes: 30,
    start,
    end,
    points: [],
    segmentMarkers: [],
    segments: segments.map(sid => ({
      id: sid,
      startTime: 0,
      endTime: 1,
      distanceKm: 5,
      durationMin: 15,
      durationHours: 0,
      durationMinutes: 15,
      start,
      end,
      points: []
    }))
  };
}

function place(lat: number, lng: number, category: "private" | "business"): BmwLearnedPlace {
  return {
    id: `place-${lat}-${lng}-${category}`,
    latitude: lat,
    longitude: lng,
    category,
    samples: { private: category === "private" ? 1 : 0, business: category === "business" ? 1 : 0 },
    updatedAt: new Date().toISOString()
  };
}

/** Liefert einen lookup, der gelernte Orte im 500m-Radius matcht. */
function lookupFrom(places: BmwLearnedPlace[]) {
  return (lat: number, lng: number): BmwLearnedPlace | undefined => {
    const R = 6_371_000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    return places.find(p => {
      const dLat = toRad(p.latitude - lat);
      const dLng = toRad(p.longitude - lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat)) * Math.cos(toRad(p.latitude)) * Math.sin(dLng / 2) ** 2;
      const dist = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
      return dist <= 500;
    });
  };
}

describe("bmwCarTripAutoCategorizer", () => {
  it("isAtHome erkennt Position im 500m-Radius", () => {
    expect(isAtHome(48.1, 11.5, HOME)).toBe(true);
    expect(isAtHome(48.1 + 0.001, 11.5, HOME)).toBe(true);
    expect(isAtHome(48.2, 11.6, HOME)).toBe(false);
  });

  it("learnableEndpoints filtert Home-Endpunkte heraus", () => {
    const e = entry("trip-1", { lat: 48.1, lng: 11.5 }, { lat: 48.2, lng: 11.6 });
    const eps = learnableEndpoints(e, HOME);
    expect(eps.length).toBe(1);
    expect(eps[0].side).toBe("end");
    expect(eps[0].lat).toBe(48.2);
  });

  it("learnableEndpoints liefert beide Endpunkte ohne Home", () => {
    const e = entry("trip-2", { lat: 48.2, lng: 11.6 }, { lat: 48.3, lng: 11.7 });
    const eps = learnableEndpoints(e, undefined);
    expect(eps.map(ep => ep.side)).toEqual(["start", "end"]);
  });

  it("learnableEndpoints liefert leere Liste bei Home→Home", () => {
    const e = entry("trip-3", { lat: 48.1, lng: 11.5 }, { lat: 48.1001, lng: 11.5001 });
    expect(learnableEndpoints(e, HOME).length).toBe(0);
  });

  it("kategorisiert Heimat→Büro anhand bekannten Büros (mit Home)", () => {
    const e = entry("trip-1", { lat: 48.1, lng: 11.5 }, { lat: 48.2, lng: 11.6 });
    const [result] = autoCategorizeTripEntries([e], {
      home: HOME,
      lookupPlace: lookupFrom([place(48.2, 11.6, "business")])
    });
    expect(result.tripCategory).toBe("business");
    expect(result.autoCategory).toBe(true);
  });

  it("kategorisiert Büro→Heimat anhand bekannten Büros (Rückfahrt)", () => {
    const e = entry("trip-1", { lat: 48.2, lng: 11.6 }, { lat: 48.1, lng: 11.5 });
    const [result] = autoCategorizeTripEntries([e], {
      home: HOME,
      lookupPlace: lookupFrom([place(48.2, 11.6, "business")])
    });
    expect(result.tripCategory).toBe("business");
    expect(result.autoCategory).toBe(true);
  });

  it("kategorisiert auch ohne Home-Bezug, wenn ein Endpunkt bekannt ist (Kunde→Restaurant)", () => {
    const e = entry("trip-1", { lat: 48.3, lng: 11.7 }, { lat: 48.4, lng: 11.8 });
    const [result] = autoCategorizeTripEntries([e], {
      home: HOME,
      lookupPlace: lookupFrom([place(48.4, 11.8, "business")])
    });
    expect(result.tripCategory).toBe("business");
    expect(result.autoCategory).toBe(true);
  });

  it("bleibt unkategorisiert bei widersprüchlichen Endpunkten", () => {
    const e = entry("trip-1", { lat: 48.3, lng: 11.7 }, { lat: 48.4, lng: 11.8 });
    const [result] = autoCategorizeTripEntries([e], {
      home: HOME,
      lookupPlace: lookupFrom([
        place(48.3, 11.7, "business"),
        place(48.4, 11.8, "private")
      ])
    });
    expect(result.tripCategory).toBeUndefined();
  });

  it("funktioniert auch ohne gesetzte Home-Position", () => {
    const e = entry("trip-1", { lat: 48.2, lng: 11.6 }, { lat: 48.3, lng: 11.7 });
    const [result] = autoCategorizeTripEntries([e], {
      home: null,
      lookupPlace: lookupFrom([place(48.3, 11.7, "business")])
    });
    expect(result.tripCategory).toBe("business");
    expect(result.autoCategory).toBe(true);
  });

  it("vererbt Gruppen-Kategorie an Segmente ohne eigene Kategorie", () => {
    const e = entry(
      "group-1",
      { lat: 48.1, lng: 11.5 },
      { lat: 48.2, lng: 11.6 },
      ["seg-a", "seg-b"]
    );
    const [result] = autoCategorizeTripEntries([e], {
      home: HOME,
      lookupPlace: lookupFrom([place(48.2, 11.6, "business")])
    });
    expect(result.segments.every(s => s.tripCategory === "business")).toBe(true);
    expect(result.segments.every(s => s.autoCategory === true)).toBe(true);
  });

  it("überschreibt vorhandene manuelle Kategorie nicht", () => {
    const e = entry("trip-1", { lat: 48.1, lng: 11.5 }, { lat: 48.2, lng: 11.6 });
    e.tripCategory = "private";
    const [result] = autoCategorizeTripEntries([e], {
      home: HOME,
      lookupPlace: lookupFrom([place(48.2, 11.6, "business")])
    });
    expect(result.tripCategory).toBe("private");
    expect(result.autoCategory).toBeUndefined();
  });

  it("lässt unkategorisiert, wenn kein passender Ort gefunden wird", () => {
    const e = entry("trip-1", { lat: 48.1, lng: 11.5 }, { lat: 48.2, lng: 11.6 });
    const [result] = autoCategorizeTripEntries([e], {
      home: HOME,
      lookupPlace: () => undefined
    });
    expect(result.tripCategory).toBeUndefined();
  });

  it("observationsFromCategorizedEntry liefert nur den fremden Ort bei Home-Berührung", () => {
    const e = entry("trip-1", { lat: 48.1, lng: 11.5 }, { lat: 48.2, lng: 11.6 });
    e.endAddress = "Bürostraße 1, München";
    const obs = observationsFromCategorizedEntry(e, HOME);
    expect(obs.length).toBe(1);
    expect(obs[0].lat).toBe(48.2);
    expect(obs[0].label).toBe("Bürostraße 1, München");
  });

  it("observationsFromCategorizedEntry liefert beide Endpunkte bei Trip ohne Home-Bezug", () => {
    const e = entry("trip-1", { lat: 48.3, lng: 11.7 }, { lat: 48.4, lng: 11.8 });
    e.startAddress = "Kunde A";
    e.endAddress = "Restaurant";
    const obs = observationsFromCategorizedEntry(e, HOME);
    expect(obs.length).toBe(2);
    expect(obs.map(o => o.label).sort()).toEqual(["Kunde A", "Restaurant"]);
  });

  it("simuliert Lern-Szenario: Office→Restaurant→Kunde", () => {
    const office = { lat: 48.2, lng: 11.6 };
    const restaurant = { lat: 48.25, lng: 11.65 };
    const customer = { lat: 48.3, lng: 11.7 };

    const trip1 = entry("trip-1", { lat: 48.1, lng: 11.5 }, office);
    trip1.tripCategory = "business";
    const obs1 = observationsFromCategorizedEntry(trip1, HOME);
    expect(obs1.length).toBe(1);
    expect(obs1[0].lat).toBe(office.lat);

    const trip2 = entry("trip-2", office, restaurant);
    trip2.tripCategory = "business";
    const obs2 = observationsFromCategorizedEntry(trip2, HOME);
    expect(obs2.length).toBe(2);

    const learned = [
      place(office.lat, office.lng, "business"),
      place(restaurant.lat, restaurant.lng, "business")
    ];
    const trip3 = entry("trip-3", customer, restaurant);
    const [result] = autoCategorizeTripEntries([trip3], {
      home: HOME,
      lookupPlace: lookupFrom(learned)
    });
    expect(result.tripCategory).toBe("business");
    expect(result.autoCategory).toBe(true);
  });
});
