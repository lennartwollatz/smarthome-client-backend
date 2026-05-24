import { reverseGeocode } from "../../../geo/nominatimReverseGeocoder.js";
import type { BmwCarTrip } from "./bmwCarTripDetector.js";
import {
  buildTripEntryFromSegments,
  groupCarTrips,
  type BmwCarTripEntry,
  type BmwCarTripSegment
} from "./bmwCarTripGrouper.js";

function hasValidCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

async function enrichTripAddresses(trip: BmwCarTrip): Promise<BmwCarTrip> {
  let startAddress = trip.startAddress;
  let endAddress = trip.endAddress;

  if (!startAddress?.trim() && hasValidCoord(trip.start.lat, trip.start.lng)) {
    startAddress = (await reverseGeocode(trip.start.lat, trip.start.lng)) || undefined;
  }
  if (!endAddress?.trim() && hasValidCoord(trip.end.lat, trip.end.lng)) {
    endAddress = (await reverseGeocode(trip.end.lat, trip.end.lng)) || undefined;
  }

  return {
    ...trip,
    startAddress: startAddress?.trim() || undefined,
    endAddress: endAddress?.trim() || undefined
  };
}

export async function enrichTripsWithAddresses(trips: BmwCarTrip[]): Promise<BmwCarTrip[]> {
  const enriched: BmwCarTrip[] = [];
  for (const trip of trips) {
    enriched.push(await enrichTripAddresses(trip));
  }
  return enriched;
}

async function enrichEntryAddresses(entry: BmwCarTripEntry): Promise<BmwCarTripEntry> {
  const enrichedSegments: BmwCarTripSegment[] = [];
  for (const seg of entry.segments) {
    enrichedSegments.push(await enrichTripAddresses(seg));
  }

  const rebuilt = buildTripEntryFromSegments(enrichedSegments, {
    autoGrouped: entry.autoGrouped
  });

  let startAddress = rebuilt.startAddress;
  let endAddress = rebuilt.endAddress;
  if (!startAddress?.trim() && hasValidCoord(rebuilt.start.lat, rebuilt.start.lng)) {
    startAddress = (await reverseGeocode(rebuilt.start.lat, rebuilt.start.lng)) || undefined;
  }
  if (!endAddress?.trim() && hasValidCoord(rebuilt.end.lat, rebuilt.end.lng)) {
    endAddress = (await reverseGeocode(rebuilt.end.lat, rebuilt.end.lng)) || undefined;
  }

  return {
    ...rebuilt,
    id: entry.id,
    startAddress: startAddress?.trim() || rebuilt.startAddress,
    endAddress: endAddress?.trim() || rebuilt.endAddress
  };
}

/** Gruppierung ohne Reverse-Geocoding (z. B. Jahresstatistik). */
export function buildGroupedTripEntriesFast(trips: BmwCarTrip[]): BmwCarTripEntry[] {
  return groupCarTrips(trips);
}

export async function buildGroupedTripEntries(trips: BmwCarTrip[]): Promise<BmwCarTripEntry[]> {
  const enriched = await enrichTripsWithAddresses(trips);
  const grouped = groupCarTrips(enriched);
  const result: BmwCarTripEntry[] = [];
  for (const entry of grouped) {
    result.push(await enrichEntryAddresses(entry));
  }
  return result;
}
