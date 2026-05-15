import { logger } from "../../logger.js";

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "SmarthomeBMW/1.0 (local smarthome installation)";
const MIN_REQUEST_INTERVAL_MS = 1100;
const CACHE_DECIMALS = 4;

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  footway?: string;
  path?: string;
  neighbourhood?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  state?: string;
  country?: string;
};

type NominatimReverseResponse = {
  display_name?: string;
  address?: NominatimAddress;
};

const cache = new Map<string, string>();
let lastRequestAt = 0;
let requestChain: Promise<void> = Promise.resolve();

export function formatNominatimAddress(data: NominatimReverseResponse): string {
  const a = data.address;
  if (!a) {
    return (data.display_name ?? "").trim();
  }

  const street = a.road ?? a.pedestrian ?? a.footway ?? a.path ?? a.neighbourhood ?? "";
  const house = a.house_number ?? "";
  const line1 = [street, house].filter(Boolean).join(" ").trim();
  const place = a.city ?? a.town ?? a.village ?? a.municipality ?? a.suburb ?? "";
  const zip = a.postcode ?? "";
  const line2 = [zip, place].filter(Boolean).join(" ").trim();
  const parts = [line1, line2].filter(p => p.length > 0);
  if (parts.length > 0) {
    return parts.join(", ");
  }
  return (data.display_name ?? "").trim();
}

function cacheKey(lat: number, lng: number): string {
  const f = 10 ** CACHE_DECIMALS;
  return `${Math.round(lat * f) / f},${Math.round(lng * f) / f}`;
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

/**
 * Reverse-Geocoding über die öffentliche Nominatim-API (OpenStreetMap).
 * Nutzungsrichtlinien: max. 1 Anfrage/Sekunde, gültiger User-Agent.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  language = "de"
): Promise<string | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const key = cacheKey(latitude, longitude);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  return scheduleRequest(async () => {
    const cachedAgain = cache.get(key);
    if (cachedAgain) {
      return cachedAgain;
    }

    const url = new URL(NOMINATIM_REVERSE_URL);
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", language);

    try {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" }
      });
      if (!res.ok) {
        logger.warn({ status: res.status, lat: latitude, lng: longitude }, "Nominatim Reverse-Geocoding fehlgeschlagen");
        return null;
      }
      const data = (await res.json()) as NominatimReverseResponse;
      const formatted = formatNominatimAddress(data);
      if (!formatted) {
        return null;
      }
      cache.set(key, formatted);
      return formatted;
    } catch (err) {
      logger.warn({ err, lat: latitude, lng: longitude }, "Nominatim Reverse-Geocoding Fehler");
      return null;
    }
  });
}

/** Nur für Tests: Cache leeren. */
export function clearNominatimCacheForTests(): void {
  cache.clear();
  lastRequestAt = 0;
  requestChain = Promise.resolve();
}
