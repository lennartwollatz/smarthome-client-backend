import { JsonRepository } from "../../../db/jsonRepository.js";
import type { DatabaseManager } from "../../../db/database.js";
import { BMW_DEFAULT_TANK_CAPACITY_LITERS } from "./bmwCarTripDetector.js";

export type BmwCarFuelSettings = {
  /** Tankvolumen in Litern. */
  tankCapacityLiters: number;
  /** ISO-Zeitstempel der letzten Änderung. */
  updatedAt: string;
};

type BmwCarFuelSettingsPersisted = {
  tankCapacityLiters?: number;
  updatedAt?: string;
};

/** Plausibilitätsfenster für das Tankvolumen (Liter). */
export const BMW_TANK_CAPACITY_MIN_LITERS = 5;
export const BMW_TANK_CAPACITY_MAX_LITERS = 200;

/**
 * Speichert die manuell eingestellte Tankgröße pro BMW-Fahrzeug. Wird im
 * Trip-Detektor genutzt, um aus den Tank-Prozenten den Liter-Verbrauch zu
 * berechnen.
 */
export class BMWCarFuelSettingsStore {
  private repository: JsonRepository<BmwCarFuelSettingsPersisted>;

  constructor(databaseManager: DatabaseManager) {
    this.repository = new JsonRepository<BmwCarFuelSettingsPersisted>(
      databaseManager,
      "BMWCarFuelSettings"
    );
  }

  getSettings(deviceId: string): BmwCarFuelSettings {
    if (!deviceId) {
      return {
        tankCapacityLiters: BMW_DEFAULT_TANK_CAPACITY_LITERS,
        updatedAt: new Date(0).toISOString()
      };
    }
    const persisted = this.repository.findById(deviceId);
    const liters =
      persisted?.tankCapacityLiters != null &&
      Number.isFinite(persisted.tankCapacityLiters) &&
      persisted.tankCapacityLiters > 0
        ? persisted.tankCapacityLiters
        : BMW_DEFAULT_TANK_CAPACITY_LITERS;
    return {
      tankCapacityLiters: liters,
      updatedAt: persisted?.updatedAt ?? new Date(0).toISOString()
    };
  }

  /** Liefert die effektiv zu verwendende Tankgröße (Liter). */
  getCapacityLiters(deviceId: string): number {
    return this.getSettings(deviceId).tankCapacityLiters;
  }

  /**
   * Setzt die Tankgröße. Werte ausserhalb [BMW_TANK_CAPACITY_MIN_LITERS,
   * BMW_TANK_CAPACITY_MAX_LITERS] werden abgelehnt (null-Rückgabe).
   */
  setCapacity(deviceId: string, tankCapacityLiters: number): BmwCarFuelSettings | null {
    if (!deviceId) return null;
    if (
      !Number.isFinite(tankCapacityLiters) ||
      tankCapacityLiters < BMW_TANK_CAPACITY_MIN_LITERS ||
      tankCapacityLiters > BMW_TANK_CAPACITY_MAX_LITERS
    ) {
      return null;
    }
    const rounded = Math.round(tankCapacityLiters * 10) / 10;
    const settings: BmwCarFuelSettingsPersisted = {
      tankCapacityLiters: rounded,
      updatedAt: new Date().toISOString()
    };
    this.repository.save(deviceId, settings);
    return {
      tankCapacityLiters: rounded,
      updatedAt: settings.updatedAt!
    };
  }

  /** Setzt die Einstellung auf den Default zurück. */
  reset(deviceId: string): BmwCarFuelSettings {
    if (deviceId) {
      try {
        this.repository.deleteById(deviceId);
      } catch {
        /* ignore */
      }
    }
    return {
      tankCapacityLiters: BMW_DEFAULT_TANK_CAPACITY_LITERS,
      updatedAt: new Date(0).toISOString()
    };
  }
}
