import { JsonRepository } from "../../../db/jsonRepository.js";
import type { DatabaseManager } from "../../../db/database.js";
import { isValidCoord } from "./bmwGeo.js";

/** Radius (in Metern) um die Home-Position, in dem ein Trip-Endpunkt als "zu Hause" gilt. */
export const BMW_HOME_RADIUS_METERS = 500;

export type BmwCarHome = {
  latitude: number;
  longitude: number;
  /** Optionaler Name (z. B. Adresse), nur zur Anzeige. */
  label?: string;
  /** ISO-Zeitstempel der letzten Aktualisierung. */
  updatedAt: string;
};

type BmwCarHomePersisted = {
  home?: BmwCarHome;
};

/** Speichert die Home-Position (Heimat-Parkplatz) pro Fahrzeug-Device. */
export class BMWCarHomeStore {
  private repository: JsonRepository<BmwCarHomePersisted>;

  constructor(databaseManager: DatabaseManager) {
    this.repository = new JsonRepository<BmwCarHomePersisted>(databaseManager, "BMWCarHome");
  }

  private read(deviceId: string): BmwCarHomePersisted {
    if (!deviceId) return {};
    return this.repository.findById(deviceId) ?? {};
  }

  getHome(deviceId: string): BmwCarHome | undefined {
    const home = this.read(deviceId).home;
    if (!home) return undefined;
    if (!isValidCoord(home.latitude, home.longitude)) return undefined;
    return home;
  }

  setHome(
    deviceId: string,
    latitude: number,
    longitude: number,
    label?: string
  ): BmwCarHome | null {
    if (!deviceId) return null;
    if (!isValidCoord(latitude, longitude)) return null;
    const home: BmwCarHome = {
      latitude,
      longitude,
      label: label?.trim() ? label.trim() : undefined,
      updatedAt: new Date().toISOString()
    };
    this.repository.save(deviceId, { home });
    return home;
  }

  clearHome(deviceId: string): void {
    if (!deviceId) return;
    try {
      this.repository.deleteById(deviceId);
    } catch {
      /* ignore */
    }
  }
}
