import type { BmwTripCategory } from "./bmwCarTripCategory.js";
import type { BmwCarTrip, BmwCarTripPoint } from "./bmwCarTripDetector.js";

/** Stopp zwischen zwei Einzelfahrten unter dieser Dauer → automatische Gruppierung. */
export const BMW_TRIP_GROUP_MAX_STOP_MS = 15 * 60 * 1000;

export type BmwCarTripSegmentMarker = {
  segmentId: string;
  index: number;
  lat: number;
  lng: number;
};

export type BmwCarTripSegment = BmwCarTrip & {
  /** Pause bis zur nächsten Etappe (nur bei gruppierten Fahrten, nicht letzte Etappe). */
  stopDurationMin?: number;
  tripCategory?: BmwTripCategory;
  /** Kategorie wurde automatisch (über gelernte Orte) ermittelt, nicht vom User gesetzt. */
  autoCategory?: boolean;
};

export type BmwCarTripEntry = {
  id: string;
  grouped: boolean;
  autoGrouped: boolean;
  startTime: number;
  endTime: number;
  distanceKm: number;
  durationMin: number;
  durationHours: number;
  durationMinutes: number;
  mileageKmBefore?: number;
  mileageKmAfter?: number;
  mileageDrivenKm?: number;
  fuelPercentBefore?: number;
  fuelPercentAfter?: number;
  fuelConsumptionPer100Km?: number;
  startAddress?: string;
  endAddress?: string;
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  points: BmwCarTripPoint[];
  segmentMarkers: BmwCarTripSegmentMarker[];
  segments: BmwCarTripSegment[];
  tripCategory?: BmwTripCategory;
  /** Kategorie wurde automatisch (über gelernte Orte) ermittelt, nicht vom User gesetzt. */
  autoCategory?: boolean;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function computeDurationParts(startTime: number, endTime: number): {
  durationMin: number;
  durationHours: number;
  durationMinutes: number;
} {
  const durationMs = Math.max(0, endTime - startTime);
  const totalMin = Math.max(1, Math.round(durationMs / 60_000));
  const durationHours = Math.floor(durationMs / 3_600_000);
  const durationMinutes = Math.floor((durationMs % 3_600_000) / 60_000);
  return { durationMin: totalMin, durationHours, durationMinutes };
}

function computeFuelConsumptionPer100Km(
  fuelBefore?: number,
  fuelAfter?: number,
  distanceKm?: number
): number | undefined {
  if (
    fuelBefore == null ||
    fuelAfter == null ||
    distanceKm == null ||
    distanceKm <= 0 ||
    fuelBefore < fuelAfter
  ) {
    return undefined;
  }
  const usedPercent = fuelBefore - fuelAfter;
  if (usedPercent <= 0) return undefined;
  return round1((usedPercent / distanceKm) * 100);
}

function segmentMarkerForTrip(trip: BmwCarTrip, index: number): BmwCarTripSegmentMarker | null {
  const lat = trip.start.lat;
  const lng = trip.start.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    if (trip.points.length > 0) {
      return {
        segmentId: trip.id,
        index,
        lat: trip.points[0].lat,
        lng: trip.points[0].lng
      };
    }
    return null;
  }
  return { segmentId: trip.id, index, lat, lng };
}

function buildSegmentsWithStops(segments: BmwCarTrip[]): BmwCarTripSegment[] {
  return segments.map((seg, i) => {
    let stopDurationMin: number | undefined;
    if (i < segments.length - 1) {
      const gapMs = segments[i + 1].startTime - seg.endTime;
      stopDurationMin = Math.max(0, Math.round(gapMs / 60_000));
    }
    return { ...seg, stopDurationMin };
  });
}

function aggregateDistanceKm(segments: BmwCarTrip[]): number {
  let sum = 0;
  let has = false;
  for (const s of segments) {
    const d = s.mileageDrivenKm ?? s.distanceKm;
    if (d > 0) {
      sum += d;
      has = true;
    }
  }
  if (has) return round1(sum);

  const first = segments[0];
  const last = segments[segments.length - 1];
  if (
    first.mileageKmBefore != null &&
    last.mileageKmAfter != null &&
    last.mileageKmAfter >= first.mileageKmBefore
  ) {
    return round1(last.mileageKmAfter - first.mileageKmBefore);
  }
  return round1(segments.reduce((acc, s) => acc + s.distanceKm, 0));
}

export function buildTripEntryFromSegments(
  segments: BmwCarTrip[],
  opts: { autoGrouped: boolean }
): BmwCarTripEntry {
  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const segmentsWithStops = buildSegmentsWithStops(sorted);
  const grouped = sorted.length > 1;

  const allPoints = sorted
    .flatMap(s => s.points)
    .sort((a, b) => a.time - b.time);

  const segmentMarkers: BmwCarTripSegmentMarker[] = [];
  sorted.forEach((seg, i) => {
    const m = segmentMarkerForTrip(seg, i + 1);
    if (m) segmentMarkers.push(m);
  });

  const mileageKmBefore = first.mileageKmBefore;
  const mileageKmAfter = last.mileageKmAfter;
  let mileageDrivenKm: number | undefined;
  if (
    mileageKmBefore != null &&
    mileageKmAfter != null &&
    mileageKmAfter >= mileageKmBefore
  ) {
    mileageDrivenKm = round1(mileageKmAfter - mileageKmBefore);
  } else {
    mileageDrivenKm = aggregateDistanceKm(sorted);
  }

  const fuelPercentBefore = first.fuelPercentBefore;
  const fuelPercentAfter = last.fuelPercentAfter;
  const distanceKm = mileageDrivenKm ?? aggregateDistanceKm(sorted);
  const { durationMin, durationHours, durationMinutes } = computeDurationParts(
    first.startTime,
    last.endTime
  );

  return {
    id: grouped ? `group-${first.id}` : first.id,
    grouped,
    autoGrouped: grouped && opts.autoGrouped,
    startTime: first.startTime,
    endTime: last.endTime,
    distanceKm,
    durationMin,
    durationHours,
    durationMinutes,
    mileageKmBefore,
    mileageKmAfter,
    mileageDrivenKm,
    fuelPercentBefore,
    fuelPercentAfter,
    fuelConsumptionPer100Km: computeFuelConsumptionPer100Km(
      fuelPercentBefore,
      fuelPercentAfter,
      distanceKm > 0 ? distanceKm : undefined
    ),
    startAddress: first.startAddress,
    endAddress: last.endAddress,
    start: first.start,
    end: last.end,
    points: allPoints,
    segmentMarkers,
    segments: segmentsWithStops
  };
}

/**
 * Gruppiert aufeinanderfolgende Einzelfahrten, wenn der Stopp dazwischen < 15 Minuten ist.
 */
export function groupCarTrips(
  trips: BmwCarTrip[],
  maxStopMs: number = BMW_TRIP_GROUP_MAX_STOP_MS
): BmwCarTripEntry[] {
  if (trips.length === 0) return [];

  const sorted = [...trips].sort((a, b) => a.startTime - b.startTime);
  const batches: BmwCarTrip[][] = [];
  let current: BmwCarTrip[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const stopMs = cur.startTime - prev.endTime;
    if (stopMs >= 0 && stopMs < maxStopMs) {
      current.push(cur);
    } else {
      batches.push(current);
      current = [cur];
    }
  }
  batches.push(current);

  const entries = batches.map(batch =>
    buildTripEntryFromSegments(batch, { autoGrouped: batch.length > 1 })
  );

  return entries.sort((a, b) => b.startTime - a.startTime);
}
