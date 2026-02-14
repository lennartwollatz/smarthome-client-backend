import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { ModuleDeviceDiscover } from "../moduleDeviceDiscover.js";
import { BMWDeviceDiscovered } from "./bmwDeviceDiscovered.js";
import { BMWMODULE } from "./bmwModule.js";
import { BMWDeviceController } from "./bmwDeviceController.js";
import type { BMWCredentials } from "./bmwCredentialsStore.js";

export class BMWDeviceDiscover extends ModuleDeviceDiscover<BMWDeviceDiscovered> {
  private controller: BMWDeviceController;
  private credentialsProvider: () => BMWCredentials | null;

  constructor(
    databaseManager: DatabaseManager,
    controller: BMWDeviceController,
    credentialsProvider: () => BMWCredentials | null
  ) {
    super(databaseManager);
    this.controller = controller;
    this.credentialsProvider = credentialsProvider;
  }

  getModuleName(): string {
    return BMWMODULE.name;
  }

  getDiscoveredDeviceTypeName(): string {
    return "BMWDeviceDiscovered";
  }

  async startDiscovery(_timeoutSeconds: number): Promise<BMWDeviceDiscovered[]> {
    const credentials = this.credentialsProvider();
    if (!credentials?.username || !credentials.password) {
      logger.warn("BMW Discovery abgebrochen - Username/Passwort fehlen");
      return [];
    }
    return await this.controller.discoverVehicles(credentials);
  }

  async stopDiscovery(): Promise<void> {
    // Kein aktiver Netzwerk-Discovery-Stream.
  }
}

