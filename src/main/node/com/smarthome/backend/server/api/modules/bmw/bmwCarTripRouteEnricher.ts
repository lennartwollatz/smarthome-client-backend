import {
  fetchRouteGeometryForPoints,
  type OrsRoutePoint
} from "../../../geo/openRouteServiceClient.js";
import type { BmwCarTripPoint } from "./bmwCarTripDetector.js";
import type {
  BmwCarTripEntry,
  BmwCarTripRouteGeometry,
  BmwCarTripSegment
} from "./bmwCarTripGrouper.js";

function toRoutePoints(points: BmwCarTripPoint[]): OrsRoutePoint[] {
  return points.map(p => ({ lat: p.lat, lng: p.lng }));
}

async function enrichTripRoute<T extends { points: BmwCarTripPoint[]; route?: BmwCarTripRouteGeometry }>(
  trip: T
): Promise<T> {
  const geometry = await fetchRouteGeometryForPoints(toRoutePoints(trip.points));
  if (!geometry) return trip;
  return { ...trip, route: geometry };
}

export async function enrichEntryWithRoute(entry: BmwCarTripEntry): Promise<BmwCarTripEntry> {
  const enrichedSegments: BmwCarTripSegment[] = [];
  for (const segment of entry.segments) {
    enrichedSegments.push(await enrichTripRoute(segment));
  }

  const withSegmentRoutes: BmwCarTripEntry = {
    ...entry,
    segments: enrichedSegments
  };

  return enrichTripRoute(withSegmentRoutes);
}

export async function enrichEntriesWithRoutes(
  entries: BmwCarTripEntry[]
): Promise<BmwCarTripEntry[]> {
  const enriched: BmwCarTripEntry[] = [];
  for (const entry of entries) {
    enriched.push(await enrichEntryWithRoute(entry));
  }
  return enriched;
}
