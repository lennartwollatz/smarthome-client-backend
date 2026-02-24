import type { DatabaseManager } from "../../../db/database.js";
import { ModuleDeviceDiscover } from "../moduleDeviceDiscover.js";
import { CalendarDeviceDiscovered } from "./calendarDeviceDiscovered.js";
import { CALENDARCONFIG, CALENDARMODULE } from "./calendarModule.js";

export class CalendarDeviceDiscover extends ModuleDeviceDiscover<CalendarDeviceDiscovered> {
  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  public getModuleName(): string {
    return CALENDARMODULE.name;
  }

  public getDiscoveredDeviceTypeName(): string {
    return CALENDARCONFIG.deviceTypeName;
  }

  public async startDiscovery(_timeoutSeconds: number): Promise<CalendarDeviceDiscovered[]> {
    // Kalender-Core hat keine klassischen Netzwerk-Devices
    return [];
  }

  public async stopDiscovery(): Promise<void> {
    // nothing
  }
}


