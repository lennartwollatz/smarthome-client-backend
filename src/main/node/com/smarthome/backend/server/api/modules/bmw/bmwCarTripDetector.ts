import type { BmwTelemetryHistoryPoint } from "../../../db/bmwCarTelemetryHistoryStore.js";

const LAT_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.latitude";
const LNG_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.longitude";
const MILEAGE_KEY = "vehicle.vehicle.travelledDistance";
const FUEL_KEY = "vehicle.drivetrain.fuelSystem.level";

export const BMW_TRIP_METRIC_KEYS = [MILEAGE_KEY, FUEL_KEY] as const;

export const BMW_IN_USE_TELEMETRY_KEYS = [
  "vehicle.status.car.inUse",
  "vehicle.status.car.inUseState"
] as const;

/** Max. plausibel angenommene Geschwindigkeit zwischen zwei Punkten (Filter Ausreißer). */
const MAX_SPEED_KMH = 200;

export type BmwCarTripPoint = { time: number; lat: number; lng: number };

export type BmwCarTrip = {
  id: string;
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
};

export type InUseInterval = { startTime: number; endTime: number };

function toNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toInUseBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
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

/** GPS-Punkte innerhalb eines Intervalls filtern und Ausreißer entfernen. */
export function sliceTrackForInterval(
  track: BmwCarTripPoint[],
  startTime: number,
  endTime: number
): BmwCarTripPoint[] {
  const inRange = track.filter(p => p.time >= startTime && p.time <= endTime);
  if (inRange.length <= 1) return inRange;

  const filtered: BmwCarTripPoint[] = [inRange[0]];
  for (let i = 1; i < inRange.length; i++) {
    const prev = filtered[filtered.length - 1];
    const cur = inRange[i];
    if (isPlausibleStep(prev, cur)) {
      filtered.push(cur);
    }
  }
  return filtered;
}

/** Sammelt Statuswechsel „In Benutzung“ aus der Telemetrie-Historie. */
export function collectInUseEvents(
  series: Record<string, BmwTelemetryHistoryPoint[]>
): { time: number; inUse: boolean }[] {
  const events: { time: number; inUse: boolean }[] = [];
  for (const key of BMW_IN_USE_TELEMETRY_KEYS) {
    for (const p of series[key] ?? []) {
      const inUse = toInUseBool(p.value);
      if (inUse !== undefined) {
        events.push({ time: p.time, inUse });
      }
    }
  }
  events.sort((a, b) => a.time - b.time);

  const deduped: { time: number; inUse: boolean }[] = [];
  for (const e of events) {
    const last = deduped[deduped.length - 1];
    if (last && last.time === e.time) {
      last.inUse = e.inUse;
    } else {
      deduped.push({ ...e });
    }
  }
  return deduped;
}

/**
 * Fahrt-Intervalle: Start wenn Motor an (inUse true), Ende wenn Motor aus (inUse false).
 */
export function detectInUseIntervals(
  series: Record<string, BmwTelemetryHistoryPoint[]>,
  fromMs: number,
  toMs: number
): InUseInterval[] {
  const events = collectInUseEvents(series);
  if (events.length === 0) return [];

  let inUse = false;
  for (const e of events) {
    if (e.time <= fromMs) {
      inUse = e.inUse;
    } else {
      break;
    }
  }

  const intervals: InUseInterval[] = [];
  let tripStart: number | null = inUse ? fromMs : null;

  for (const e of events) {
    if (e.time < fromMs) continue;
    if (e.time > toMs) break;

    if (e.inUse && !inUse) {
      tripStart = e.time;
    } else if (!e.inUse && inUse && tripStart != null) {
      intervals.push({ startTime: tripStart, endTime: e.time });
      tripStart = null;
    }
    inUse = e.inUse;
  }

  if (inUse && tripStart != null) {
    intervals.push({ startTime: tripStart, endTime: toMs });
  }

  return intervals;
}

/** Letzter bekannter Zahlenwert zum Zeitpunkt (inkl. davor). */
export function lastNumericValueAt(
  series: BmwTelemetryHistoryPoint[] | undefined,
  timeMs: number
): number | undefined {
  if (!series?.length) return undefined;
  let last: number | undefined;
  for (const p of series) {
    if (p.time > timeMs) break;
    const n = toNum(p.value);
    if (n != null) last = n;
  }
  return last;
}

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

export function buildTripFromInterval(
  interval: InUseInterval,
  trackPoints: BmwCarTripPoint[],
  metrics?: {
    mileageSeries?: BmwTelemetryHistoryPoint[];
    fuelSeries?: BmwTelemetryHistoryPoint[];
  }
): BmwCarTrip {
  const { startTime, endTime } = interval;
  const { durationMin, durationHours, durationMinutes } = computeDurationParts(startTime, endTime);
  const points = sliceTrackForInterval(trackPoints, startTime, endTime);

  const mileageKmBefore = lastNumericValueAt(metrics?.mileageSeries, startTime);
  const mileageKmAfter = lastNumericValueAt(metrics?.mileageSeries, endTime);
  const fuelPercentBefore = lastNumericValueAt(metrics?.fuelSeries, startTime);
  const fuelPercentAfter = lastNumericValueAt(metrics?.fuelSeries, endTime);

  let mileageDrivenKm: number | undefined;
  if (
    mileageKmBefore != null &&
    mileageKmAfter != null &&
    mileageKmAfter >= mileageKmBefore
  ) {
    mileageDrivenKm = round1(mileageKmAfter - mileageKmBefore);
  }

  const base = {
    id: `trip-${startTime}`,
    startTime,
    endTime,
    durationMin,
    durationHours,
    durationMinutes,
    mileageKmBefore: mileageKmBefore != null ? round1(mileageKmBefore) : undefined,
    mileageKmAfter: mileageKmAfter != null ? round1(mileageKmAfter) : undefined,
    mileageDrivenKm,
    fuelPercentBefore: fuelPercentBefore != null ? round1(fuelPercentBefore) : undefined,
    fuelPercentAfter: fuelPercentAfter != null ? round1(fuelPercentAfter) : undefined
  };

  if (points.length === 0) {
    const distanceKm = mileageDrivenKm ?? 0;
    return {
      ...base,
      distanceKm,
      fuelConsumptionPer100Km: computeFuelConsumptionPer100Km(
        fuelPercentBefore,
        fuelPercentAfter,
        distanceKm > 0 ? distanceKm : undefined
      ),
      start: { lat: 0, lng: 0 },
      end: { lat: 0, lng: 0 },
      points: []
    };
  }

  const start = points[0];
  const end = points[points.length - 1];
  const distM = points.length >= 2 ? segmentDistanceM(points) : 0;
  const gpsDistanceKm = round1(distM / 1000);
  const distanceKm = mileageDrivenKm ?? gpsDistanceKm;
  if (base.mileageDrivenKm == null && gpsDistanceKm > 0) {
    base.mileageDrivenKm = gpsDistanceKm;
  }

  return {
    ...base,
    distanceKm,
    fuelConsumptionPer100Km: computeFuelConsumptionPer100Km(
      fuelPercentBefore,
      fuelPercentAfter,
      distanceKm > 0 ? distanceKm : undefined
    ),
    start: { lat: start.lat, lng: start.lng },
    end: { lat: end.lat, lng: end.lng },
    points
  };
}

/**
 * Erkennt Fahrten der letzten 30 Tage: je Motor-an-Phase („In Benutzung“) eine Fahrt,
 * Strecke und Route aus GPS-Punkten innerhalb des Intervalls.
 */
export function detectTripsFromHistorySeries(
  series: Record<string, BmwTelemetryHistoryPoint[]>,
  fromMs: number,
  toMs: number
): BmwCarTrip[] {
  const intervals = detectInUseIntervals(series, fromMs, toMs);
  if (intervals.length === 0) return [];

  const track = buildLocationTrack(series);
  const metrics = {
    mileageSeries: series[MILEAGE_KEY],
    fuelSeries: series[FUEL_KEY]
  };
  const trips = intervals.map(interval => buildTripFromInterval(interval, track, metrics));
  return trips.sort((a, b) => b.startTime - a.startTime);
}

/** @deprecated Nur noch für Tests – Produktion nutzt detectInUseIntervals. */
export function detectTripsFromTrack(track: BmwCarTripPoint[]): BmwCarTrip[] {
  if (track.length < 2) return [];
  const start = track[0];
  const end = track[track.length - 1];
  return [
    buildTripFromInterval(
      { startTime: start.time, endTime: end.time },
      track
    )
  ];
}
