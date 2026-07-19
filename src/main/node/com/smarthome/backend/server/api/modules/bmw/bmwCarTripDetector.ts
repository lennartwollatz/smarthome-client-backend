import type { BmwTelemetryHistoryPoint } from "../../../db/bmwCarTelemetryHistoryStore.js";

const LAT_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.latitude";
const LNG_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.longitude";
const MILEAGE_KEY = "vehicle.vehicle.travelledDistance";
const RANGE_KEY = "vehicle.drivetrain.lastRemainingRange";
const FUEL_KEY = "vehicle.drivetrain.fuelSystem.level";

export const BMW_TRIP_METRIC_KEYS = [MILEAGE_KEY, RANGE_KEY, FUEL_KEY] as const;

/** Telematik-Key: Fahrertür vorne links (Historie, kein Trip-Trigger). */
export const BMW_DRIVER_DOOR_KEY = "vehicle.cabin.door.row1.driver.isOpen";

/**
 * Pause ohne MQTT-Status, ab der eine laufende Fahrt als beendet gilt.
 * BMW sendet bei Statusänderungen Telemetrie; fehlen Updates länger als diese
 * Dauer, gilt das Fahrzeug als geparkt.
 */
export const BMW_TRIP_STATUS_SILENCE_MS = 30 * 60 * 1000;

/**
 * Toleranzradius für „gleicher Standort“ beim Parken (Meter). GPS-Drift in
 * dieser Größenordnung gilt nicht als Bewegung.
 */
export const BMW_TRIP_PARKED_RADIUS_M = 60;

/**
 * Mindest-Kilometerstand-Differenz zum letzten Parkplatz, damit eine Fahrt
 * beginnt (falls GPS noch am alten Ort liegt).
 */
export const BMW_TRIP_MIN_MILEAGE_DELTA_KM = 0.1;

/**
 * Mindest-Distanz (km) einer erkannten Fahrt. Kürzere Intervalle werden verworfen.
 */
export const BMW_TRIP_MIN_DISTANCE_KM = 0.3;

/** Trigger-Keys für Monatsauswahl und Telemetrie-Laden (GPS + Tachostand). */
export const BMW_TRIP_TRIGGER_KEYS = [MILEAGE_KEY, LAT_KEY, LNG_KEY] as const;

/** Standardgröße des Tanks (Liter) – pro Auto manuell überschreibbar. */
export const BMW_DEFAULT_TANK_CAPACITY_LITERS = 60;

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
  /** Verbrauch in Litern pro 100 km (sofern Tankgröße und Tankprozente vorhanden). */
  fuelConsumptionPer100Km?: number;
  /** Verbrauchte Kraftstoffmenge der Fahrt in Litern. */
  fuelUsedLiters?: number;
  /** Verwendete Tankgröße in Litern (zur Berechnung von fuelUsedLiters / Verbrauch). */
  tankCapacityLiters?: number;
  startAddress?: string;
  endAddress?: string;
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  points: BmwCarTripPoint[];
};

/** Zeit-Intervall einer erkannten Fahrt (Trip-Start bis Trip-Ende). */
export type InUseInterval = { startTime: number; endTime: number };

function toNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toBool(v: unknown): boolean | undefined {
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

/**
 * Sammelt Tür-Auf-Events (false → true) der Fahrertür vorne links aus der
 * Telemetrie-Historie. Aufeinanderfolgende gleiche Zustände werden ignoriert.
 * Eine erste Beobachtung mit `true` zählt ebenfalls als Tür-Auf-Event (z. B.
 * direkt nach Aufzeichnungsstart, wenn der vorherige Zustand unbekannt war).
 */
export function collectDriverDoorOpenEvents(
  series: Record<string, BmwTelemetryHistoryPoint[]>
): { time: number }[] {
  const points = (series[BMW_DRIVER_DOOR_KEY] ?? [])
    .slice()
    .sort((a, b) => a.time - b.time);

  const events: { time: number }[] = [];
  let prevOpen: boolean | undefined;
  for (const p of points) {
    const isOpen = toBool(p.value);
    if (isOpen === undefined) continue;
    if (isOpen === true && prevOpen !== true) {
      events.push({ time: p.time });
    }
    prevOpen = isOpen;
  }
  return events;
}

type ParkedState = {
  sinceTime: number;
  lat?: number;
  lng?: number;
  mileage?: number;
};

/** Alle eindeutigen Zeitpunkte aus der Telemetrie-Historie (jeder MQTT-Status). */
export function collectStatusUpdateTimes(
  series: Record<string, BmwTelemetryHistoryPoint[]>
): number[] {
  const times = new Set<number>();
  for (const points of Object.values(series)) {
    for (const p of points) {
      if (Number.isFinite(p.time)) times.add(p.time);
    }
  }
  return [...times].sort((a, b) => a - b);
}

function locationAtTime(
  series: Record<string, BmwTelemetryHistoryPoint[]>,
  timeMs: number
): { lat?: number; lng?: number } {
  return {
    lat: lastNumericValueAt(series[LAT_KEY], timeMs),
    lng: lastNumericValueAt(series[LNG_KEY], timeMs)
  };
}

function isAtParkedLocation(
  lat: number | undefined,
  lng: number | undefined,
  mileage: number | undefined,
  parked: ParkedState,
  radiusM: number
): boolean {
  if (parked.lat != null && parked.lng != null && lat != null && lng != null) {
    if (haversineMeters(parked.lat, parked.lng, lat, lng) > radiusM) {
      return false;
    }
  }
  if (
    parked.mileage != null &&
    mileage != null &&
    mileage > parked.mileage + BMW_TRIP_MIN_MILEAGE_DELTA_KM
  ) {
    return false;
  }
  return true;
}

function hasLeftParkedLocation(
  lat: number | undefined,
  lng: number | undefined,
  mileage: number | undefined,
  parked: ParkedState,
  radiusM: number
): boolean {
  return !isAtParkedLocation(lat, lng, mileage, parked, radiusM);
}

/**
 * Gefahrene Strecke (km): Tacho, Restreichweite, GPS.
 * Ein Tacho-Delta von 0 blockiert nicht GPS/Restreichweite.
 */
export function computeDrivenKmBetween(
  mileageSeries: BmwTelemetryHistoryPoint[] | undefined,
  rangeSeries: BmwTelemetryHistoryPoint[] | undefined,
  track: BmwCarTripPoint[],
  startMs: number,
  endMs: number
): number | undefined {
  const candidates: number[] = [];

  const mileageKm = mileageDeltaKmBetween(mileageSeries, startMs, endMs);
  if (mileageKm != null && mileageKm > 0) candidates.push(mileageKm);

  const rangeKm = rangeDeltaKmBetween(rangeSeries, startMs, endMs);
  if (rangeKm != null && rangeKm > 0) candidates.push(rangeKm);

  const gpsKm = gpsDistanceKmBetween(track, startMs, endMs);
  if (gpsKm > 0) candidates.push(gpsKm);

  if (candidates.length > 0) {
    return Math.max(...candidates);
  }

  if (mileageKm === 0 || rangeKm === 0) return 0;
  if (mileageKm == null && rangeKm == null && gpsKm === 0) return undefined;
  return 0;
}

/**
 * Fahrt-Intervalle aus MQTT-Status-Updates.
 *
 * - Jede Telemetrie-Änderung zählt als Status-Update.
 * - Fehlen Updates länger als {@link BMW_TRIP_STATUS_SILENCE_MS}, endet die Fahrt
 *   zum Zeitpunkt des letzten empfangenen Status.
 * - Eine neue Fahrt beginnt erst, wenn sich Standort oder Kilometerstand gegenüber
 *   dem letzten Parkplatz geändert haben; Startzeit ist der Parkzeitpunkt.
 */
export function detectTripIntervalsFromStatusUpdates(
  series: Record<string, BmwTelemetryHistoryPoint[]>,
  fromMs: number,
  toMs: number,
  options: {
    silenceMs?: number;
    parkedRadiusM?: number;
    minDistanceKm?: number;
  } = {}
): InUseInterval[] {
  const silenceMs = options.silenceMs ?? BMW_TRIP_STATUS_SILENCE_MS;
  const parkedRadiusM = options.parkedRadiusM ?? BMW_TRIP_PARKED_RADIUS_M;
  const minDistanceKm = options.minDistanceKm ?? BMW_TRIP_MIN_DISTANCE_KM;

  const statusTimes = collectStatusUpdateTimes(series);
  if (statusTimes.length === 0) return [];

  const track = buildLocationTrack(series);
  const mileageSeries = series[MILEAGE_KEY];
  const rangeSeries = series[RANGE_KEY];

  const firstTime = statusTimes[0];
  const firstLoc = locationAtTime(series, firstTime);
  let parked: ParkedState = {
    sinceTime: firstTime,
    lat: firstLoc.lat,
    lng: firstLoc.lng,
    mileage: lastNumericValueAt(mileageSeries, firstTime)
  };

  let inTrip = false;
  let tripStart: number | null = null;
  let lastStatusTime: number | null = null;
  const rawIntervals: InUseInterval[] = [];

  const finishTrip = (endTime: number) => {
    if (tripStart != null && endTime > tripStart) {
      rawIntervals.push({ startTime: tripStart, endTime });
    }
    inTrip = false;
    tripStart = null;
    const endLoc = locationAtTime(series, endTime);
    parked = {
      sinceTime: endTime,
      lat: endLoc.lat,
      lng: endLoc.lng,
      mileage: lastNumericValueAt(mileageSeries, endTime)
    };
  };

  for (const t of statusTimes) {
    if (lastStatusTime != null && inTrip && t - lastStatusTime >= silenceMs) {
      finishTrip(lastStatusTime);
    }

    const { lat, lng } = locationAtTime(series, t);
    const mileage = lastNumericValueAt(mileageSeries, t);

    if (!inTrip) {
      if (hasLeftParkedLocation(lat, lng, mileage, parked, parkedRadiusM)) {
        inTrip = true;
        tripStart = parked.sinceTime;
      } else {
        parked = {
          sinceTime: t,
          lat: lat ?? parked.lat,
          lng: lng ?? parked.lng,
          mileage: mileage ?? parked.mileage
        };
      }
    }

    lastStatusTime = t;
  }

  if (inTrip && lastStatusTime != null && tripStart != null) {
    if (toMs - lastStatusTime >= silenceMs) {
      finishTrip(lastStatusTime);
    } else {
      rawIntervals.push({ startTime: tripStart, endTime: toMs });
    }
  }

  const intervals: InUseInterval[] = [];
  for (const interval of rawIntervals) {
    if (interval.startTime < fromMs || interval.startTime > toMs) continue;
    if (interval.endTime <= interval.startTime) continue;

    const drivenKm = computeDrivenKmBetween(
      mileageSeries,
      rangeSeries,
      track,
      interval.startTime,
      interval.endTime
    );
    if (drivenKm != null && drivenKm < minDistanceKm) continue;

    intervals.push(interval);
  }

  return intervals;
}

/** Zurückgelegte Strecke (km) zwischen zwei Zeitpunkten anhand des Tachostands. */
function mileageDeltaKmBetween(
  mileageSeries: BmwTelemetryHistoryPoint[] | undefined,
  startMs: number,
  endMs: number
): number | undefined {
  const before = lastNumericValueAt(mileageSeries, startMs);
  const after = lastNumericValueAt(mileageSeries, endMs);
  if (before == null || after == null) return undefined;
  const delta = after - before;
  return delta > 0 ? delta : undefined;
}

/**
 * Zurückgelegte Strecke (km) aus der Restreichweite: sinkt die Reichweite zwischen
 * Start und Ende, entspricht die Differenz der gefahrenen Strecke.
 */
function rangeDeltaKmBetween(
  rangeSeries: BmwTelemetryHistoryPoint[] | undefined,
  startMs: number,
  endMs: number
): number | undefined {
  const before = lastNumericValueAt(rangeSeries, startMs);
  const after = lastNumericValueAt(rangeSeries, endMs);
  if (before == null || after == null) return undefined;
  const delta = before - after;
  return delta > 0 ? delta : undefined;
}

/** GPS-Strecke (km) entlang des Tracks zwischen zwei Zeitpunkten als Fallback. */
function gpsDistanceKmBetween(
  track: BmwCarTripPoint[],
  startMs: number,
  endMs: number
): number {
  const slice = track.filter(p => p.time >= startMs && p.time <= endMs);
  if (slice.length < 2) return 0;
  return segmentDistanceM(slice) / 1000;
}

/**
 * @deprecated Nur noch für Tests – Produktion nutzt detectTripIntervalsFromStatusUpdates.
 * Fahrt-Intervalle aus Tür-Auf-Events der Fahrertür vorne links.
 */
export function detectTripIntervalsFromDoorOpenEvents(
  series: Record<string, BmwTelemetryHistoryPoint[]>,
  fromMs: number,
  toMs: number
): InUseInterval[] {
  const events = collectDriverDoorOpenEvents(series);
  if (events.length === 0) return [];

  const intervals: InUseInterval[] = [];

  for (let i = 0; i + 1 < events.length; i += 2) {
    const start = events[i].time;
    const end = events[i + 1].time;
    if (start > toMs) break;
    if (start < fromMs) continue;
    if (end <= start) continue;
    intervals.push({ startTime: start, endTime: end });
  }

  if (events.length % 2 === 1) {
    const start = events[events.length - 1].time;
    if (start >= fromMs && start <= toMs && start < toMs) {
      intervals.push({ startTime: start, endTime: toMs });
    }
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

/**
 * Verbrauchte Kraftstoffmenge in Litern aus der Tankprozent-Differenz.
 * Erfordert eine gültige Tankgröße – ohne diese ist die Liter-Angabe undefiniert.
 */
function computeFuelUsedLiters(
  fuelBefore?: number,
  fuelAfter?: number,
  tankCapacityLiters?: number
): number | undefined {
  if (
    fuelBefore == null ||
    fuelAfter == null ||
    tankCapacityLiters == null ||
    tankCapacityLiters <= 0 ||
    fuelBefore < fuelAfter
  ) {
    return undefined;
  }
  const usedPercent = fuelBefore - fuelAfter;
  if (usedPercent <= 0) return undefined;
  return round1((usedPercent / 100) * tankCapacityLiters);
}

/** Verbrauch in L/100 km auf Basis verbrauchter Liter und Distanz. */
function computeFuelConsumptionPer100Km(
  fuelUsedLiters?: number,
  distanceKm?: number
): number | undefined {
  if (
    fuelUsedLiters == null ||
    fuelUsedLiters <= 0 ||
    distanceKm == null ||
    distanceKm <= 0
  ) {
    return undefined;
  }
  return round1((fuelUsedLiters / distanceKm) * 100);
}

export function buildTripFromInterval(
  interval: InUseInterval,
  trackPoints: BmwCarTripPoint[],
  metrics?: {
    mileageSeries?: BmwTelemetryHistoryPoint[];
    rangeSeries?: BmwTelemetryHistoryPoint[];
    fuelSeries?: BmwTelemetryHistoryPoint[];
    tankCapacityLiters?: number;
  }
): BmwCarTrip {
  const { startTime, endTime } = interval;
  const { durationMin, durationHours, durationMinutes } = computeDurationParts(startTime, endTime);
  const points = sliceTrackForInterval(trackPoints, startTime, endTime);

  const mileageKmBefore = lastNumericValueAt(metrics?.mileageSeries, startTime);
  const mileageKmAfter = lastNumericValueAt(metrics?.mileageSeries, endTime);
  const fuelPercentBefore = lastNumericValueAt(metrics?.fuelSeries, startTime);
  const fuelPercentAfter = lastNumericValueAt(metrics?.fuelSeries, endTime);
  const tankCapacityLiters = metrics?.tankCapacityLiters;

  let mileageDrivenKm: number | undefined;
  if (
    mileageKmBefore != null &&
    mileageKmAfter != null &&
    mileageKmAfter >= mileageKmBefore
  ) {
    mileageDrivenKm = round1(mileageKmAfter - mileageKmBefore);
  }

  if (mileageDrivenKm == null) {
    const rangeDelta = rangeDeltaKmBetween(metrics?.rangeSeries, startTime, endTime);
    if (rangeDelta != null) {
      mileageDrivenKm = round1(rangeDelta);
    }
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
    fuelPercentAfter: fuelPercentAfter != null ? round1(fuelPercentAfter) : undefined,
    tankCapacityLiters:
      tankCapacityLiters != null && tankCapacityLiters > 0 ? tankCapacityLiters : undefined
  };

  const fuelUsedLiters = computeFuelUsedLiters(
    fuelPercentBefore,
    fuelPercentAfter,
    tankCapacityLiters
  );

  if (points.length === 0) {
    const distanceKm = mileageDrivenKm ?? 0;
    return {
      ...base,
      distanceKm,
      fuelUsedLiters,
      fuelConsumptionPer100Km: computeFuelConsumptionPer100Km(
        fuelUsedLiters,
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
    fuelUsedLiters,
    fuelConsumptionPer100Km: computeFuelConsumptionPer100Km(
      fuelUsedLiters,
      distanceKm > 0 ? distanceKm : undefined
    ),
    start: { lat: start.lat, lng: start.lng },
    end: { lat: end.lat, lng: end.lng },
    points
  };
}

/**
 * Erkennt Fahrten aus MQTT-Status-Updates: Ende nach 30 Minuten ohne Telemetrie,
 * Start bei Verlassen des letzten Parkplatzes (Standort/Kilometerstand).
 */
export function detectTripsFromHistorySeries(
  series: Record<string, BmwTelemetryHistoryPoint[]>,
  fromMs: number,
  toMs: number,
  options: { tankCapacityLiters?: number } = {}
): BmwCarTrip[] {
  const intervals = detectTripIntervalsFromStatusUpdates(series, fromMs, toMs);
  if (intervals.length === 0) return [];

  const track = buildLocationTrack(series);
  const metrics = {
    mileageSeries: series[MILEAGE_KEY],
    rangeSeries: series[RANGE_KEY],
    fuelSeries: series[FUEL_KEY],
    tankCapacityLiters: options.tankCapacityLiters
  };
  const trips = intervals.map(interval => buildTripFromInterval(interval, track, metrics));
  return trips.sort((a, b) => b.startTime - a.startTime);
}

/** @deprecated Nur noch für Tests – Produktion nutzt detectTripIntervalsFromStatusUpdates. */
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
