import { JsonRepository } from "../../../db/jsonRepository.js";
import type { DatabaseManager } from "../../../db/database.js";

const STORE_ID = "bmw-vehicle-names";

type BMWVehicleNamesPersisted = {
  byVin: Record<string, string>;
};

export function normalizeBmwVin(vin: string): string {
  return vin.trim().toUpperCase();
}

export class BMWVehicleNamesStore {
  private repository: JsonRepository<BMWVehicleNamesPersisted>;

  constructor(databaseManager: DatabaseManager) {
    this.repository = new JsonRepository<BMWVehicleNamesPersisted>(databaseManager, "BMWVehicleNames");
  }

  private read(): BMWVehicleNamesPersisted {
    return this.repository.findById(STORE_ID) ?? { byVin: {} };
  }

  private write(data: BMWVehicleNamesPersisted): void {
    this.repository.save(STORE_ID, data);
  }

  getName(vin: string): string | undefined {
    const key = normalizeBmwVin(vin);
    if (!key) return undefined;
    const name = this.read().byVin[key];
    return typeof name === "string" && name.trim() ? name.trim() : undefined;
  }

  getAll(): Record<string, string> {
    return { ...this.read().byVin };
  }

  setName(vin: string, name: string): void {
    const key = normalizeBmwVin(vin);
    if (!key) return;
    const trimmed = name.trim();
    const data = this.read();
    if (!trimmed) {
      delete data.byVin[key];
    } else {
      data.byVin[key] = trimmed;
    }
    this.write(data);
  }
}
