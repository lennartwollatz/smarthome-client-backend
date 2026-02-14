import { logger } from "../../../logger.js";
import { DatabaseManager } from "../../db/database.js";
import { JsonRepository } from "../../db/jsonRepository.js";
import { ModuleDeviceDiscovered } from "./moduleDeviceDiscovered.js";

export abstract class ModuleDeviceDiscover<D extends ModuleDeviceDiscovered> {
  private repository: JsonRepository<D>;

  constructor(databaseManager: DatabaseManager) {
    this.repository = new JsonRepository<D>(databaseManager, this.getDiscoveredDeviceTypeName());
  }

  public async discover(timeoutSeconds: number): Promise<D[]>{
    logger.info("Starte Discovery fuer "+this.getModuleName());
    let devices = await this.startDiscovery(timeoutSeconds);
    await this.stopDiscovery();
    devices.forEach(device => {
      this.repository.save(device.id, device);
      logger.info(this.getModuleName()+" Discovered Device: "+JSON.stringify(device));
    });
    return devices;
  }

  public abstract getModuleName(): string;
  public abstract getDiscoveredDeviceTypeName():string;
  public abstract startDiscovery(timeoutSeconds: number): Promise<D[]>;
  public abstract stopDiscovery(): Promise<void>;

}

