import type { BmwTripCategory } from "./bmwCarTripCategory.js";
import type { BmwCarTripEntry, BmwCarTripSegment } from "./bmwCarTripGrouper.js";
import { haversineMeters, isValidCoord } from "./bmwGeo.js";
import type { BmwCarHome } from "./bmwCarHomeStore.js";
import { BMW_HOME_RADIUS_METERS } from "./bmwCarHomeStore.js";
import type { BmwLearnedPlace } from "./bmwCarLearnedPlacesStore.js";

export type BmwTripEndpointSide = "start" | "end";

export type BmwTripEndpoint = {
  side: BmwTripEndpointSide;
  lat: number;
  lng: number;
  address?: string;
};

/** Liegt eine Position innerhalb des Home-Radius? */
export function isAtHome(
  lat: number,
  lng: number,
  home: BmwCarHome,
  radiusMeters: number = BMW_HOME_RADIUS_METERS
): boolean {
  if (!isValidCoord(lat, lng)) return false;
  return haversineMeters(lat, lng, home.latitude, home.longitude) <= radiusMeters;
}

/**
 * Liefert alle Endpunkte einer Fahrt, die für das Lernen/Matching relevant sind:
 * gültige Koordinaten und – wenn eine Home-Position bekannt ist – nicht zu Hause.
 */
export function learnableEndpoints(
  entry: Pick<BmwCarTripEntry, "start" | "end" | "startAddress" | "endAddress">,
  home?: BmwCarHome | null,
  homeRadiusMeters: number = BMW_HOME_RADIUS_METERS
): BmwTripEndpoint[] {
  const result: BmwTripEndpoint[] = [];
  const ends: { side: BmwTripEndpointSide; lat: number; lng: number; addr?: string }[] = [
    { side: "start", lat: entry.start.lat, lng: entry.start.lng, addr: entry.startAddress },
    { side: "end", lat: entry.end.lat, lng: entry.end.lng, addr: entry.endAddress }
  ];
  for (const e of ends) {
    if (!isValidCoord(e.lat, e.lng)) continue;
    if (home && isAtHome(e.lat, e.lng, home, homeRadiusMeters)) continue;
    result.push({ side: e.side, lat: e.lat, lng: e.lng, address: e.addr });
  }
  return result;
}

export type BmwCarTripAutoCategorizerOptions = {
  home?: BmwCarHome | null;
  /** Liefert die Kategorie eines gespeicherten Orts in der Nähe (oder undefined). */
  lookupPlace: (lat: number, lng: number) => BmwLearnedPlace | undefined;
  /** Radius, in dem ein Ende „zu Hause" zählt. Default: BMW_HOME_RADIUS_METERS. */
  homeRadiusMeters?: number;
};

/**
 * Ergänzt automatische Kategorien für noch nicht klassifizierte Trip-Einträge.
 * Pro Fahrt werden Start- und/oder End-Position (sofern nicht zu Hause) gegen die Liste
 * der gelernten Orte abgeglichen. Übereinstimmende Kategorien werden übernommen,
 * widersprüchliche bleiben unkategorisiert. Vererbt die Gruppen-Kategorie an
 * Segmente ohne eigene manuelle Kategorie.
 */
export function autoCategorizeTripEntries(
  entries: BmwCarTripEntry[],
  opts: BmwCarTripAutoCategorizerOptions
): BmwCarTripEntry[] {
  const homeRadius = opts.homeRadiusMeters ?? BMW_HOME_RADIUS_METERS;
  const home = opts.home ?? undefined;

  return entries.map(entry => {
    const baseSegments: BmwCarTripSegment[] = entry.segments.map(seg => ({ ...seg }));
    let category: BmwTripCategory | undefined = entry.tripCategory;
    let autoCategory = entry.autoCategory === true;

    if (!category) {
      category = inferEntryCategory(entry, home, opts.lookupPlace, homeRadius);
      autoCategory = category != null;
    }

    if (category) {
      for (const seg of baseSegments) {
        if (!seg.tripCategory) {
          seg.tripCategory = category;
          seg.autoCategory = autoCategory ? true : seg.autoCategory;
        }
      }
    }

    return {
      ...entry,
      tripCategory: category,
      autoCategory: autoCategory || undefined,
      segments: baseSegments
    };
  });
}

function inferEntryCategory(
  entry: BmwCarTripEntry,
  home: BmwCarHome | undefined,
  lookup: (lat: number, lng: number) => BmwLearnedPlace | undefined,
  homeRadius: number
): BmwTripCategory | undefined {
  const endpoints = learnableEndpoints(entry, home, homeRadius);
  if (endpoints.length === 0) return undefined;

  const categories: BmwTripCategory[] = [];
  for (const ep of endpoints) {
    const place = lookup(ep.lat, ep.lng);
    if (place) categories.push(place.category);
  }
  if (categories.length === 0) return undefined;
  if (categories.every(c => c === categories[0])) return categories[0];
  return undefined;
}

/**
 * Liefert alle Beobachtungen, die aus einer manuell kategorisierten Fahrt gelernt werden
 * können: jeden Endpunkt, der nicht zu Hause liegt (bei gesetztem Home) bzw. gültig ist.
 */
export function observationsFromCategorizedEntry(
  entry: Pick<BmwCarTripEntry, "start" | "end" | "startAddress" | "endAddress">,
  home?: BmwCarHome | null,
  homeRadiusMeters: number = BMW_HOME_RADIUS_METERS
): { lat: number; lng: number; label?: string }[] {
  return learnableEndpoints(entry, home ?? undefined, homeRadiusMeters).map(ep => ({
    lat: ep.lat,
    lng: ep.lng,
    label: ep.address?.trim() ? ep.address.trim() : undefined
  }));
}

