import { JsonRepository } from "../../../db/jsonRepository.js";
import type { DatabaseManager } from "../../../db/database.js";
import { haversineMeters, isValidCoord } from "./bmwGeo.js";
import { isBmwTripCategory, type BmwTripCategory } from "./bmwCarTripCategory.js";

/** Radius (in Metern), in dem ein neuer Punkt als gleicher Ort wie ein bekannter gilt. */
export const BMW_LEARNED_PLACE_RADIUS_METERS = 500;

export type BmwLearnedPlace = {
  id: string;
  latitude: number;
  longitude: number;
  /** Mehrheitsvotum: höchste Sample-Zahl gewinnt. */
  category: BmwTripCategory;
  /** Anzahl der User-Bestätigungen je Kategorie. */
  samples: { private: number; business: number };
  label?: string;
  /** ISO-Zeitstempel der letzten Aktualisierung. */
  updatedAt: string;
};

type BmwLearnedPlacesPersisted = {
  places: BmwLearnedPlace[];
};

function clonePlaces(persisted: BmwLearnedPlacesPersisted): BmwLearnedPlace[] {
  return persisted.places.map(p => ({
    ...p,
    samples: { ...p.samples }
  }));
}

function pickCategory(samples: BmwLearnedPlace["samples"]): BmwTripCategory {
  if (samples.business === samples.private) return "private";
  return samples.business > samples.private ? "business" : "private";
}

function nextId(places: BmwLearnedPlace[]): string {
  const used = new Set(places.map(p => p.id));
  let i = places.length + 1;
  while (used.has(`place-${i}`)) i++;
  return `place-${i}`;
}

/**
 * Speichert pro Fahrzeug eine Liste „gelernter Orte" mit Kategorie.
 * Neue Punkte werden auf bestehende Cluster im Radius
 * BMW_LEARNED_PLACE_RADIUS_METERS aggregiert.
 */
export class BMWCarLearnedPlacesStore {
  private repository: JsonRepository<BmwLearnedPlacesPersisted>;

  constructor(databaseManager: DatabaseManager) {
    this.repository = new JsonRepository<BmwLearnedPlacesPersisted>(
      databaseManager,
      "BMWCarLearnedPlaces"
    );
  }

  private read(deviceId: string): BmwLearnedPlacesPersisted {
    if (!deviceId) return { places: [] };
    const raw = this.repository.findById(deviceId) ?? { places: [] };
    raw.places = (raw.places ?? []).filter(
      p =>
        p &&
        isValidCoord(p.latitude, p.longitude) &&
        isBmwTripCategory(p.category) &&
        p.samples &&
        typeof p.samples.private === "number" &&
        typeof p.samples.business === "number"
    );
    return raw;
  }

  private write(deviceId: string, data: BmwLearnedPlacesPersisted): void {
    if (!deviceId) return;
    this.repository.save(deviceId, data);
  }

  getAll(deviceId: string): BmwLearnedPlace[] {
    return clonePlaces(this.read(deviceId));
  }

  /** Findet den nächsten Cluster innerhalb des Radius zur gegebenen Position. */
  findNearest(
    deviceId: string,
    latitude: number,
    longitude: number,
    radiusMeters: number = BMW_LEARNED_PLACE_RADIUS_METERS
  ): BmwLearnedPlace | undefined {
    if (!isValidCoord(latitude, longitude)) return undefined;
    let best: BmwLearnedPlace | undefined;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const place of this.read(deviceId).places) {
      const dist = haversineMeters(latitude, longitude, place.latitude, place.longitude);
      if (dist <= radiusMeters && dist < bestDist) {
        best = place;
        bestDist = dist;
      }
    }
    return best;
  }

  /**
   * Fügt eine Beobachtung (Position + Kategorie) hinzu.
   * Liegt sie innerhalb des Cluster-Radius eines bestehenden Orts, wird der Sample-Zähler
   * dieser Kategorie erhöht und ggf. die Mehrheitskategorie aktualisiert. Ansonsten wird
   * ein neuer Ort angelegt.
   */
  registerObservation(
    deviceId: string,
    latitude: number,
    longitude: number,
    category: BmwTripCategory,
    label?: string
  ): BmwLearnedPlace | null {
    if (!deviceId) return null;
    if (!isValidCoord(latitude, longitude)) return null;
    if (!isBmwTripCategory(category)) return null;

    const data = this.read(deviceId);
    const existing = this.findNearest(deviceId, latitude, longitude);
    const now = new Date().toISOString();

    if (existing) {
      const idx = data.places.findIndex(p => p.id === existing.id);
      if (idx >= 0) {
        const place = data.places[idx];
        place.samples[category] += 1;
        place.category = pickCategory(place.samples);
        place.updatedAt = now;
        if (label?.trim() && !place.label) {
          place.label = label.trim();
        }
        this.write(deviceId, data);
        return { ...place, samples: { ...place.samples } };
      }
    }

    const place: BmwLearnedPlace = {
      id: nextId(data.places),
      latitude,
      longitude,
      category,
      samples: { private: category === "private" ? 1 : 0, business: category === "business" ? 1 : 0 },
      label: label?.trim() ? label.trim() : undefined,
      updatedAt: now
    };
    data.places.push(place);
    this.write(deviceId, data);
    return { ...place, samples: { ...place.samples } };
  }

  /**
   * Zieht eine vorherige Beobachtung zurück (z. B. wenn der User die Kategorie ändert/entfernt).
   * Findet den nächsten Cluster und dekrementiert dort den Sample-Zähler. Wird ein Cluster
   * dadurch leer, wird er gelöscht.
   */
  retractObservation(
    deviceId: string,
    latitude: number,
    longitude: number,
    category: BmwTripCategory
  ): void {
    if (!deviceId) return;
    if (!isValidCoord(latitude, longitude)) return;
    if (!isBmwTripCategory(category)) return;

    const data = this.read(deviceId);
    const idx = data.places.findIndex(p => {
      const dist = haversineMeters(latitude, longitude, p.latitude, p.longitude);
      return dist <= BMW_LEARNED_PLACE_RADIUS_METERS;
    });
    if (idx < 0) return;

    const place = data.places[idx];
    place.samples[category] = Math.max(0, place.samples[category] - 1);
    if (place.samples.private === 0 && place.samples.business === 0) {
      data.places.splice(idx, 1);
    } else {
      place.category = pickCategory(place.samples);
      place.updatedAt = new Date().toISOString();
    }
    this.write(deviceId, data);
  }

  deletePlace(deviceId: string, placeId: string): boolean {
    if (!deviceId || !placeId) return false;
    const data = this.read(deviceId);
    const before = data.places.length;
    data.places = data.places.filter(p => p.id !== placeId);
    if (data.places.length === before) return false;
    this.write(deviceId, data);
    return true;
  }

  deleteByDeviceId(deviceId: string): void {
    try {
      this.repository.deleteById(deviceId);
    } catch {
      /* ignore */
    }
  }
}
