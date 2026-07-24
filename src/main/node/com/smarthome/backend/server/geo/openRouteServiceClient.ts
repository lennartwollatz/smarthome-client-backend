import { logger } from "../../logger.js";

const ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";
const ORS_DEFAULT_PROFILE = "driving-car";
const MAX_WAYPOINTS = 50;
const MIN_REQUEST_INTERVAL_MS = 250;
const COORD_CACHE_DECIMALS = 4;

export type OrsRoutePoint = { lat: number; lng: number };

export type OrsLineStringGeometry = {
  type: "LineString";
  /** GeoJSON-Koordinaten [lng, lat][] entlang der Straßenroute. */
  coordinates: [number, number][];
};

type OrsGeoJsonResponse = {
  type?: string;
  features?: Array<{
    geometry?: {
      type?: string;
      coordinates?: [number, number][];
    };
  }>;
};

const geometryCache = new Map<string, OrsLineStringGeometry | null>();
let lastRequestAt = 0;
let requestChain: Promise<void> = Promise.resolve();

function getOrsApiKey(): string | undefined {
  const key = process.env.ORS_API_KEY?.trim() || process.env.OPENROUTESERVICE_API_KEY?.trim();
  return key && key.length > 0 ? key : undefined;
}

export function isOrsConfigured(): boolean {
  return getOrsApiKey() != null;
}

function isValidCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

function coordKey(lat: number, lng: number): string {
  const f = 10 ** COORD_CACHE_DECIMALS;
  return `${Math.round(lat * f) / f},${Math.round(lng * f) / f}`;
}

function dedupeConsecutivePoints(points: OrsRoutePoint[]): OrsRoutePoint[] {
  const out: OrsRoutePoint[] = [];
  for (const point of points) {
    if (!isValidCoord(point.lat, point.lng)) continue;
    const prev = out[out.length - 1];
    if (prev && coordKey(prev.lat, prev.lng) === coordKey(point.lat, point.lng)) {
      continue;
    }
    out.push(point);
  }
  return out;
}

/**
 * Reduziert GPS-Punkte auf höchstens {@link MAX_WAYPOINTS} Wegpunkte für ORS Directions.
 * Start- und Endpunkt bleiben erhalten.
 */
export function simplifyRoutePoints(
  points: OrsRoutePoint[],
  maxPoints: number = MAX_WAYPOINTS
): OrsRoutePoint[] {
  const cleaned = dedupeConsecutivePoints(points);
  if (cleaned.length <= maxPoints) return cleaned;
  if (maxPoints < 2) return cleaned.slice(0, 1);

  const simplified: OrsRoutePoint[] = [cleaned[0]];
  const slots = maxPoints - 2;
  const step = (cleaned.length - 2) / (slots + 1);

  for (let i = 1; i <= slots; i += 1) {
    const index = Math.min(cleaned.length - 2, Math.round(i * step));
    simplified.push(cleaned[index]);
  }

  simplified.push(cleaned[cleaned.length - 1]);
  return dedupeConsecutivePoints(simplified);
}

function cacheKeyForPoints(points: OrsRoutePoint[]): string {
  return points.map(p => coordKey(p.lat, p.lng)).join("|");
}

function scheduleRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = requestChain.then(async () => {
    const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait));
    }
    lastRequestAt = Date.now();
    return fn();
  });
  requestChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function parseGeoJsonRouteGeometry(data: OrsGeoJsonResponse): OrsLineStringGeometry | null {
  const feature = data.features?.[0];
  const geometry = feature?.geometry;
  if (geometry?.type !== "LineString" || !Array.isArray(geometry.coordinates)) {
    return null;
  }

  const coordinates = geometry.coordinates.filter(
    (pair): pair is [number, number] =>
      Array.isArray(pair) &&
      pair.length >= 2 &&
      Number.isFinite(pair[0]) &&
      Number.isFinite(pair[1])
  );

  if (coordinates.length < 2) return null;
  return { type: "LineString", coordinates };
}

function mergeLineGeometries(parts: OrsLineStringGeometry[]): OrsLineStringGeometry | null {
  const coordinates: [number, number][] = [];
  for (const part of parts) {
    for (const coord of part.coordinates) {
      const prev = coordinates[coordinates.length - 1];
      if (prev && prev[0] === coord[0] && prev[1] === coord[1]) {
        continue;
      }
      coordinates.push(coord);
    }
  }
  if (coordinates.length < 2) return null;
  return { type: "LineString", coordinates };
}

async function fetchDirectionsGeometry(points: OrsRoutePoint[]): Promise<OrsLineStringGeometry | null> {
  const apiKey = getOrsApiKey();
  if (!apiKey) return null;
  if (points.length < 2) return null;

  const coordinates = points.map(p => [p.lng, p.lat] as [number, number]);

  try {
    const res = await fetch(ORS_DIRECTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        Accept: "application/geo+json, application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ coordinates })
    });

    if (!res.ok) {
      logger.warn(
        { status: res.status, pointCount: points.length, profile: ORS_DEFAULT_PROFILE },
        "OpenRouteService Directions fehlgeschlagen"
      );
      return null;
    }

    const data = (await res.json()) as OrsGeoJsonResponse;
    return parseGeoJsonRouteGeometry(data);
  } catch (err) {
    logger.warn({ err, pointCount: points.length }, "OpenRouteService Directions Fehler");
    return null;
  }
}

/**
 * Verbindet Fahrt-Koordinaten über ORS Directions zu einer Straßen-GeoJSON-Route.
 * Gibt `null` zurück, wenn kein API-Key gesetzt ist, zu wenige Punkte vorliegen
 * oder ORS die Anfrage ablehnt.
 */
export async function fetchRouteGeometryForPoints(
  points: OrsRoutePoint[]
): Promise<OrsLineStringGeometry | null> {
  const simplified = simplifyRoutePoints(points);
  if (simplified.length < 2) return null;

  const cacheKey = cacheKeyForPoints(simplified);
  if (geometryCache.has(cacheKey)) {
    return geometryCache.get(cacheKey) ?? null;
  }

  if (!isOrsConfigured()) {
    return null;
  }

  return scheduleRequest(async () => {
    const cached = geometryCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    if (simplified.length <= MAX_WAYPOINTS) {
      const geometry = await fetchDirectionsGeometry(simplified);
      geometryCache.set(cacheKey, geometry);
      return geometry;
    }

    const parts: OrsLineStringGeometry[] = [];
    for (let start = 0; start < simplified.length - 1; start += MAX_WAYPOINTS - 1) {
      const end = Math.min(simplified.length, start + MAX_WAYPOINTS);
      const chunk = simplified.slice(start, end);
      if (chunk.length < 2) continue;
      const geometry = await fetchDirectionsGeometry(chunk);
      if (!geometry) {
        geometryCache.set(cacheKey, null);
        return null;
      }
      parts.push(geometry);
      if (end >= simplified.length) break;
    }

    const merged = mergeLineGeometries(parts);
    geometryCache.set(cacheKey, merged);
    return merged;
  });
}

/** Nur für Tests: Cache leeren. */
export function clearOpenRouteServiceCacheForTests(): void {
  geometryCache.clear();
  lastRequestAt = 0;
  requestChain = Promise.resolve();
}
