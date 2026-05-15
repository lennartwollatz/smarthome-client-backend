import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { ModuleDeviceDiscover } from "../moduleDeviceDiscover.js";
import { BMWDeviceDiscovered } from "./bmwDeviceDiscovered.js";
import { BMWMODULE } from "./bmwModule.js";
import { BMWDeviceController } from "./bmwDeviceController.js";
import { BMW_CARDATA_DISCOVERY_TIMEOUT_MS } from "./bmwCarDataDefaults.js";

export class BMWDeviceDiscover extends ModuleDeviceDiscover<BMWDeviceDiscovered> {
  private controller: BMWDeviceController;

  constructor(databaseManager: DatabaseManager, controller: BMWDeviceController) {
    super(databaseManager);
    this.controller = controller;
  }

  getModuleName(): string {
    return BMWMODULE.name;
  }

  getDiscoveredDeviceTypeName(): string {
    return "BMWDeviceDiscovered";
  }

  async startDiscovery(_timeoutSeconds: number): Promise<BMWDeviceDiscovered[]> {
    return await this.controller.discoverVehiclesViaMqtt(BMW_CARDATA_DISCOVERY_TIMEOUT_MS);
  }

  async stopDiscovery(): Promise<void> {
    logger.debug("BMW Discovery beendet (MQTT bleibt fuer Stream aktiv)");
  }
}
