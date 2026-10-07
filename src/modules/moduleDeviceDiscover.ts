import { DatabaseManager } from "../db/database.js";
import { DiscoveredDeviceRepository } from "../db/repositories/DiscoveredDeviceRepository.js";
import { ModuleDeviceDiscovered } from "./moduleDeviceDiscovered.js";

export abstract class ModuleDeviceDiscover<D extends ModuleDeviceDiscovered> {
  private repository: DiscoveredDeviceRepository<D>;

  constructor(databaseManager: DatabaseManager) {
    this.repository = new DiscoveredDeviceRepository<D>(databaseManager, this.getDiscoveredDeviceTypeName());
  }

  public async discover(
    timeoutSeconds: number,
    existingDevicesIds: string[]
  ): Promise<D[]>{
    let devices = await this.startDiscovery(timeoutSeconds);
    await this.stopDiscovery();

    for (const device of devices) {
      if (!existingDevicesIds.some(d => d === device.id)) {
        await this.repository.save(device.id, device);
      }
    }

    return devices.filter(d => !existingDevicesIds.some(id => id === d.id));
  }

  /** Discovered Device aus der Persistenz lesen (für modul-spezifische Daten wie Matter nodeId/fabric, Tokens, ...) */
  public async getStored(id: string): Promise<D | null> {
    return this.repository.findById(id);
  }

  /** Discovered Device in der Persistenz speichern (Merge mit bestehendem Datensatz) */
  public async upsertStored(id: string, patch: Partial<D> & { id?: string }): Promise<D> {
    const existing = (await this.repository.findById(id)) ?? ({} as D);
    const merged = { ...existing, ...patch, id } as D;
    await this.repository.save(id, merged);
    return merged;
  }

   /** Discovered Device in der Persistenz speichern (Merge mit bestehendem Datensatz) */
  public async setStored(id: string, device: D): Promise<void> {
    await this.repository.save(id, device);
  }

  public async deleteStored(id: string): Promise<boolean> {
    return this.repository.deleteById(id);
  }

  /** Alle gespeicherten Discovered-Devices lesen */
  public async listStored(): Promise<D[]> {
    return this.repository.findAll();
  }

  /**
   * Löscht alle gespeicherten Discovered-Devices, deren ID nicht in `keepIds` enthalten ist.
   * Nützlich um vor einem Discovery-Lauf "verwaiste" (nicht gepairte) Discovered-Devices zu entfernen.
   */
  public async purgeStoredNotIn(keepIds: Set<string>) {
    await this.repository.deleteAllExcept([...keepIds]);
  }

  public abstract getModuleName(): string;
  public abstract getDiscoveredDeviceTypeName():string;
  public abstract startDiscovery(timeoutSeconds: number): Promise<D[]>;
  public abstract stopDiscovery(): Promise<void>;
  
  
  public async findChangedIPAddressForDevice(device: D): Promise<D> {
    const devices = await this.startDiscovery(5);
    const newDevice = devices.find(d => d.id === device.id);
    return newDevice ?? device;
  }

}

