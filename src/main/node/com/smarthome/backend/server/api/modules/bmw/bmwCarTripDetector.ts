import type { BmwTelemetryHistoryPoint } from "../../../db/bmwCarTelemetryHistoryStore.js";

const LAT_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.latitude";
const LNG_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.longitude";

/** Pause ohne GPS-Fortschreibung → neue Fahrt. */
const TRIP_GAP_MS = 20 * 60 * 1000;
/** Mindest-Strecke für eine erkannte Fahrt. */
const MIN_TRIP_DISTANCE_M = 300;
/** Max. plausibel angenommene Geschwindigkeit zwischen zwei Punkten (Filter Ausreißer). */
const MAX_SPEED_KMH = 200;

export type BmwCarTripPoint = { time: number; lat: number; lng: number };

export type BmwCarTrip = {
  id: string;
  startTime: number;
  endTime: number;
  distanceKm: number;
  durationMin: number;
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  points: BmwCarTripPoint[];
};

function toNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Lat/Lng-Zeitreihen zu einem fortlaufenden Track zusammenführen. */
export function buildLocationTrack(
  series: Record<string, BmwTelemetryHistoryPoint[]>
): BmwCarTripPoint[] {
  const latPts = (series[LAT_KEY] ?? []).slice().sort((a, b) => a.time - b.time);
  const lngPts = (series[LNG_KEY] ?? []).slice().sort((a, b) => a.time - b.time);
  if (latPts.length === 0 || lngPts.length === 0) return [];

  const times = new Set<number>();
  for (const p of latPts) times.add(p.time);
  for (const p of lngPts) times.add(p.time);
  const sortedTimes = [...times].sort((a, b) => a - b);

  let lastLat: number | undefined;
  let lastLng: number | undefined;
  const track: BmwCarTripPoint[] = [];

  for (const time of sortedTimes) {
    const latAt = latPts.filter(p => p.time <= time).pop();
    const lngAt = lngPts.filter(p => p.time <= time).pop();
    const lat = latAt ? toNum(latAt.value) : lastLat;
    const lng = lngAt ? toNum(lngAt.value) : lastLng;
    if (lat != null) lastLat = lat;
    if (lng != null) lastLng = lng;
    if (lastLat != null && lastLng != null) {
      const prev = track[track.length - 1];
      if (!prev || prev.lat !== lastLat || prev.lng !== lastLng || prev.time !== time) {
        track.push({ time, lat: lastLat, lng: lastLng });
      }
    }
  }

  return track;
}

function segmentDistanceM(points: BmwCarTripPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += haversineMeters(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng
    );
  }
  return d;
}

function isPlausibleStep(a: BmwCarTripPoint, b: BmwCarTripPoint): boolean {
  const dtH = (b.time - a.time) / 3_600_000;
  if (dtH <= 0) return false;
  const distKm = haversineMeters(a.lat, a.lng, b.lat, b.lng) / 1000;
  return distKm / dtH <= MAX_SPEED_KMH;
}

/** Erkennt Fahrten aus einem GPS-Track (Lücken + Mindeststrecke). */
export function detectTripsFromTrack(track: BmwCarTripPoint[]): BmwCarTrip[] {
  if (track.length < 2) return [];

  const segments: BmwCarTripPoint[][] = [];
  let current: BmwCarTripPoint[] = [track[0]];

  for (let i = 1; i < track.length; i++) {
    const prev = track[i - 1];
    const cur = track[i];
    const gap = cur.time - prev.time > TRIP_GAP_MS;
    const plausible = isPlausibleStep(prev, cur);

    if (gap || !plausible) {
      if (current.length >= 2) segments.push(current);
      current = [cur];
    } else {
      current.push(cur);
    }
  }
  if (current.length >= 2) segments.push(current);

  const trips: BmwCarTrip[] = [];
  for (const seg of segments) {
    const distM = segmentDistanceM(seg);
    if (distM < MIN_TRIP_DISTANCE_M) continue;

    const start = seg[0];
    const end = seg[seg.length - 1];
    const distanceKm = Math.round((distM / 1000) * 10) / 10;
    const durationMin = Math.max(1, Math.round((end.time - start.time) / 60_000));

    trips.push({
      id: `trip-${start.time}`,
      startTime: start.time,
      endTime: end.time,
      distanceKm,
      durationMin,
      start: { lat: start.lat, lng: start.lng },
      end: { lat: end.lat, lng: end.lng },
      points: seg
    });
  }

  return trips.sort((a, b) => b.startTime - a.startTime);
}

export function detectTripsFromHistorySeries(
  series: Record<string, BmwTelemetryHistoryPoint[]>
): BmwCarTrip[] {
  return detectTripsFromTrack(buildLocationTrack(series));
}
