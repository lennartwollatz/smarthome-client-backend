import type { BmwTelemetryHistoryPoint } from "../../../db/bmwCarTelemetryHistoryStore.js";

const LAT_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.latitude";
const LNG_KEY = "vehicle.cabin.infotainment.navigation.currentLocation.longitude";
const MILEAGE_KEY = "vehicle.vehicle.travelledDistance";
const RANGE_KEY = "vehicle.drivetrain.lastRemainingRange";
const FUEL_KEY = "vehicle.drivetrain.fuelSystem.level";

export const BMW_TRIP_METRIC_KEYS = [MILEAGE_KEY, RANGE_KEY, FUEL_KEY] as const;

/** Telematik-Key: Fahrertür vorne links (Trigger für Trip-Start beim Öffnen). */
export const BMW_DRIVER_DOOR_KEY = "vehicle.cabin.door.row1.driver.isOpen";

/** Trigger-Keys, die die Fahrt-Erkennung benötigt (Tür-Auf + GPS + Tachostand). */
export const BMW_TRIP_TRIGGER_KEYS = [BMW_DRIVER_DOOR_KEY, MILEAGE_KEY, LAT_KEY, LNG_KEY] as const;

/** @deprecated Nur noch für Tests der Standphasen-Erkennung. */
export const BMW_TRIP_STATIONARY_PAUSE_MS = 5 * 60 * 1000;

/** @deprecated Nur noch für Tests der Standphasen-Erkennung. */
export const BMW_TRIP_STATIONARY_RADIUS_M = 60;

/**
 * Mindest-Distanz (km) zwischen zwei Tür-Auf-Events, damit dazwischen tatsächlich
 * eine Fahrt angenommen wird (Restreichweite, Tacho oder GPS).
 */
export const BMW_TRIP_MIN_DISTANCE_KM = 0.3;

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

/**
 * Findet das Ende einer Fahrt: der erste Zeitpunkt nach `startMs`, ab dem das
 * Fahrzeug für mindestens `stationaryPauseMs` innerhalb von `stationaryRadiusM`
 * stehen bleibt. Wird zurückgegeben als Zeitpunkt des ersten GPS-Punkts der
 * Standphase. Kein Treffer ⇒ `undefined`.
 */
export function findStationaryPauseEnd(
  track: BmwCarTripPoint[],
  startMs: number,
  searchUntilMs: number,
  stationaryPauseMs: number = BMW_TRIP_STATIONARY_PAUSE_MS,
  stationaryRadiusM: number = BMW_TRIP_STATIONARY_RADIUS_M
): number | undefined {
  if (track.length === 0) return undefined;

  const inWindow = track.filter(p => p.time >= startMs && p.time <= searchUntilMs);
  if (inWindow.length === 0) return undefined;

  let anchor: BmwCarTripPoint | null = null;
  for (let i = 0; i < inWindow.length; i++) {
    const cur = inWindow[i];
    if (!anchor) {
      anchor = cur;
      continue;
    }
    const d = haversineMeters(anchor.lat, anchor.lng, cur.lat, cur.lng);
    if (d > stationaryRadiusM) {
      anchor = cur;
      continue;
    }
    if (cur.time - anchor.time >= stationaryPauseMs) {
      return anchor.time;
    }
  }
  return undefined;
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
  return delta >= 0 ? delta : undefined;
}

/**
 * Gefahrene Strecke (km) aus der Restreichweite: sinkt sie, ist die Differenz
 * die gefahrene Distanz. Kurze Regenerations-Spitzen werden über max−min abgefangen.
 */
function rangeDeltaKmBetween(
  rangeSeries: BmwTelemetryHistoryPoint[] | undefined,
  startMs: number,
  endMs: number
): number | undefined {
  if (!rangeSeries?.length) return undefined;

  const values: number[] = [];
  const atStart = lastNumericValueAt(rangeSeries, startMs);
  if (atStart != null) values.push(atStart);
  for (const p of rangeSeries) {
    if (p.time < startMs || p.time > endMs) continue;
    const n = toNum(p.value);
    if (n != null) values.push(n);
  }
  const atEnd = lastNumericValueAt(rangeSeries, endMs);
  if (atEnd != null && (values.length === 0 || values[values.length - 1] !== atEnd)) {
    values.push(atEnd);
  }
  if (values.length < 2) return undefined;

  const drop = values[0] - values[values.length - 1];
  if (drop > 0) return drop;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min;
  return span > 0 ? span : 0;
}

/** GPS-Strecke (km) entlang des Tracks zwischen zwei Zeitpunkten. */
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
 * Beste Schätzung der gefahrenen Strecke (km): Tacho, Restreichweite, GPS.
 * Wichtig: Ein Tacho-Delta von 0 blockiert nicht GPS/Restreichweite (häufig bei
 * spärlichen travelledDistance-Updates in der MQTT-Historie).
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
 * Fahrt-Intervalle aus Tür-Auf-Events der Fahrertür vorne links.
 *
 * Jedes Tür-Auf markiert eine Grenze: Zwischen zwei aufeinanderfolgenden
 * Tür-Auf-Events liegt höchstens eine Fahrt. Endet die letzte Fahrt im Fenster
 * ohne weiteres Tür-Auf, gilt `toMs` als Ende (offene Fahrt).
 *
 * Nur Intervalle mit nachweisbarer Bewegung (≥ {@link BMW_TRIP_MIN_DISTANCE_KM})
 * werden übernommen.
 */
export function detectTripIntervalsFromDoorOpenEvents(
  series: Record<string, BmwTelemetryHistoryPoint[]>,
  fromMs: number,
  toMs: number,
  _stationaryPauseMs: number = BMW_TRIP_STATIONARY_PAUSE_MS,
  _stationaryRadiusM: number = BMW_TRIP_STATIONARY_RADIUS_M,
  minDistanceKm: number = BMW_TRIP_MIN_DISTANCE_KM
): InUseInterval[] {
  const events = collectDriverDoorOpenEvents(series);
  if (events.length === 0) return [];

  const track = buildLocationTrack(series);
  const mileageSeries = series[MILEAGE_KEY];
  const rangeSeries = series[RANGE_KEY];
  const intervals: InUseInterval[] = [];

  for (let i = 0; i < events.length; i++) {
    const start = events[i].time;
    if (start > toMs) break;
    if (start < fromMs) continue;

    let endTime = events[i + 1]?.time ?? toMs;
    if (endTime > toMs) endTime = toMs;
    if (endTime <= start) continue;

    const drivenKm = computeDrivenKmBetween(
      mileageSeries,
      rangeSeries,
      track,
      start,
      endTime
    );

    if (drivenKm != null && drivenKm < minDistanceKm) {
      continue;
    }

    intervals.push({ startTime: start, endTime });
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

  const drivenKm = computeDrivenKmBetween(
    metrics?.mileageSeries,
    metrics?.rangeSeries,
    trackPoints,
    startTime,
    endTime
  );
  let mileageDrivenKm: number | undefined =
    drivenKm != null && drivenKm > 0 ? round1(drivenKm) : undefined;
  if (
    mileageDrivenKm == null &&
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
 * Erkennt Fahrten anhand der Fahrertür: Jedes Tür-Auf-Event ist eine Grenze
 * zwischen Fahrten. Strecke aus Restreichweite, Tachostand und GPS; Route aus
 * Lat/Lng. Tankgröße fließt in Verbrauch (L/100 km) ein.
 */
export function detectTripsFromHistorySeries(
  series: Record<string, BmwTelemetryHistoryPoint[]>,
  fromMs: number,
  toMs: number,
  options: { tankCapacityLiters?: number } = {}
): BmwCarTrip[] {
  const intervals = detectTripIntervalsFromDoorOpenEvents(series, fromMs, toMs);
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

/** @deprecated Nur noch für Tests – Produktion nutzt detectTripIntervalsFromDoorEvents. */
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
