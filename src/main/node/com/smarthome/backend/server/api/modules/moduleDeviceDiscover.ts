import { logger } from "../../../logger.js";
import { DatabaseManager } from "../../db/database.js";
import { JsonRepository } from "../../db/jsonRepository.js";
import { ModuleDeviceDiscovered } from "./moduleDeviceDiscovered.js";

export abstract class ModuleDeviceDiscover<D extends ModuleDeviceDiscovered> {
  private repository: JsonRepository<D>;

  constructor(databaseManager: DatabaseManager) {
    this.repository = new JsonRepository<D>(databaseManager, this.getDiscoveredDeviceTypeName());
  }

  public async discover(
    timeoutSeconds: number,
    existingDevicesIds: string[]
  ): Promise<D[]>{
    let devices = await this.startDiscovery(timeoutSeconds);
    await this.stopDiscovery();

    devices.forEach(device => {
      if (!existingDevicesIds.some(d => d === device.id)) {
        this.repository.save(device.id, device);
      }
    });

    return devices.filter(d => !existingDevicesIds.some(id => id === d.id));
  }

  /** Discovered Device aus der Persistenz lesen (für modul-spezifische Daten wie Matter nodeId/fabric, Tokens, ...) */
  public getStored(id: string): D | null {
    return this.repository.findById(id);
  }

  /** Discovered Device in der Persistenz speichern (Merge mit bestehendem Datensatz) */
  public upsertStored(id: string, patch: Partial<D> & { id?: string }): D {
    const existing = this.repository.findById(id) ?? ({} as D);
    const merged = { ...existing, ...patch, id } as D;
    this.repository.save(id, merged);
    return merged;
  }

   /** Discovered Device in der Persistenz speichern (Merge mit bestehendem Datensatz) */
  public setStored(id: string, device: D){
    this.repository.save(id, device);
  }

  public deleteStored(id: string): boolean {
    return this.repository.deleteById(id);
  }

  /** Alle gespeicherten Discovered-Devices lesen */
  public listStored(): D[] {
    return this.repository.findAll();
  }

  /**
   * Löscht alle gespeicherten Discovered-Devices, deren ID nicht in `keepIds` enthalten ist.
   * Nützlich um vor einem Discovery-Lauf "verwaiste" (nicht gepairte) Discovered-Devices zu entfernen.
   */
  public purgeStoredNotIn(keepIds: Set<string>) {
    const all = this.repository.findAll();
    for (const d of all) {
      const id = (d as any)?.id as string | undefined;
      if (!id) continue;
      if (!keepIds.has(id)) {
        this.repository.deleteById(id);
      }
    }
  }

  public abstract getModuleName(): string;
  public abstract getDiscoveredDeviceTypeName():string;
  public abstract startDiscovery(timeoutSeconds: number): Promise<D[]>;
  public abstract stopDiscovery(): Promise<void>;

}

