import type { DeviceCarAddress, DeviceCarCoordinates } from "../../../../model/devices/DeviceCar.js";
import { reverseGeocode } from "../../../geo/nominatimReverseGeocoder.js";

const REGEOCODE_DISTANCE_M = 150;

function distanceMeters(a: DeviceCarCoordinates, b: DeviceCarCoordinates): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function shouldReverseGeocodeLocation(
  location: DeviceCarAddress,
  previous?: DeviceCarAddress
): boolean {
  if (!location.name?.trim()) {
    return true;
  }
  if (!previous?.coordinates) {
    return false;
  }
  return distanceMeters(previous.coordinates, location.coordinates) > REGEOCODE_DISTANCE_M;
}

/**
 * Ergänzt location.name per OpenStreetMap (Nominatim), wenn keine Adresse vom Fahrzeug kommt
 * oder sich die Position deutlich geändert hat.
 */
export async function enrichCarLocationAddress(
  location: DeviceCarAddress,
  previous?: DeviceCarAddress
): Promise<DeviceCarAddress> {
  if (!shouldReverseGeocodeLocation(location, previous)) {
    return location;
  }

  const { latitude, longitude } = location.coordinates;
  const name = await reverseGeocode(latitude, longitude);
  if (!name) {
    return location;
  }

  return {
    coordinates: location.coordinates,
    name
  };
}

/** Asynchrones Reverse-Geocoding; ruft onUpdated auf, wenn sich die Adresse ändert. */
export function scheduleCarLocationEnrichment(
  getLocation: () => DeviceCarAddress | undefined,
  setLocation: (location: DeviceCarAddress) => void,
  location: DeviceCarAddress,
  previous: DeviceCarAddress | undefined,
  onUpdated: () => void
): void {
  if (!shouldReverseGeocodeLocation(location, previous)) {
    return;
  }

  void enrichCarLocationAddress(location, previous).then(enriched => {
    if (!enriched.name?.trim()) {
      return;
    }
    const current = getLocation();
    if (!current) {
      return;
    }
    if (
      current.coordinates.latitude !== enriched.coordinates.latitude ||
      current.coordinates.longitude !== enriched.coordinates.longitude
    ) {
      return;
    }
    if (current.name?.trim() === enriched.name.trim()) {
      return;
    }
    setLocation(enriched);
    onUpdated();
  });
}
