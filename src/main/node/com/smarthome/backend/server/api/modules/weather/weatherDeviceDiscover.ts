import type { DatabaseManager } from "../../../db/database.js";
import { ModuleDeviceDiscover } from "../moduleDeviceDiscover.js";
import { WeatherDeviceDiscovered } from "./weatherDeviceDiscovered.js";
import { WEATHERCONFIG, WEATHERMODULE } from "./weatherModule.js";

export class WeatherDeviceDiscover extends ModuleDeviceDiscover<WeatherDeviceDiscovered> {
  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  public getModuleName(): string {
    return WEATHERMODULE.name;
  }

  public getDiscoveredDeviceTypeName(): string {
    return WEATHERCONFIG.deviceTypeName;
  }

  public async startDiscovery(_timeoutSeconds: number): Promise<WeatherDeviceDiscovered[]> {
    return [];
  }

  public async stopDiscovery(): Promise<void> {
    // nothing
  }
}
