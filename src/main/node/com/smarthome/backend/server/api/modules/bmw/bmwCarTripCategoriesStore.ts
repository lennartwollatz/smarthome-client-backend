import { JsonRepository } from "../../../db/jsonRepository.js";
import type { DatabaseManager } from "../../../db/database.js";
import { isBmwTripCategory, type BmwTripCategory } from "./bmwCarTripCategory.js";

type BMWCarTripCategoriesPersisted = {
  /** entryId → Kategorie */
  byEntryId: Record<string, BmwTripCategory>;
};

export class BMWCarTripCategoriesStore {
  private repository: JsonRepository<BMWCarTripCategoriesPersisted>;

  constructor(databaseManager: DatabaseManager) {
    this.repository = new JsonRepository<BMWCarTripCategoriesPersisted>(
      databaseManager,
      "BMWCarTripCategories"
    );
  }

  private read(deviceId: string): BMWCarTripCategoriesPersisted {
    if (!deviceId) return { byEntryId: {} };
    return this.repository.findById(deviceId) ?? { byEntryId: {} };
  }

  private write(deviceId: string, data: BMWCarTripCategoriesPersisted): void {
    if (!deviceId) return;
    this.repository.save(deviceId, data);
  }

  getCategory(deviceId: string, entryId: string): BmwTripCategory | undefined {
    if (!deviceId || !entryId) return undefined;
    const cat = this.read(deviceId).byEntryId[entryId];
    return isBmwTripCategory(cat) ? cat : undefined;
  }

  getAllForDevice(deviceId: string): Record<string, BmwTripCategory> {
    const out: Record<string, BmwTripCategory> = {};
    for (const [id, cat] of Object.entries(this.read(deviceId).byEntryId)) {
      if (isBmwTripCategory(cat)) out[id] = cat;
    }
    return out;
  }

  setCategory(deviceId: string, entryId: string, category: BmwTripCategory | null): void {
    if (!deviceId || !entryId) return;
    const data = this.read(deviceId);
    if (category == null) {
      delete data.byEntryId[entryId];
    } else {
      data.byEntryId[entryId] = category;
    }
    this.write(deviceId, data);
  }

  deleteByDeviceId(deviceId: string): void {
    try {
      this.repository.deleteById(deviceId);
    } catch {
      /* ignore */
    }
  }
}
