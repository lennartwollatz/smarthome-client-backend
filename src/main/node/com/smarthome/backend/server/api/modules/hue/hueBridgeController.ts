import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import type { HueDiscoveredBridge } from "./hueDiscoveredBridge.js";
import type { ActionManager } from "../../../actions/actionManager.js";
import type { ModuleEventStreamManager } from "../moduleEventStreamManager.js";
import { HueModuleEventStreamManager } from "./hueModuleEventStreamManager.js";
import { v3 } from "node-hue-api";

export class HueBridgeController {
  private bridgeRepository?: JsonRepository<HueDiscoveredBridge>;
  private databaseManager: DatabaseManager;

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
    if (databaseManager) {
      this.bridgeRepository = new JsonRepository<HueDiscoveredBridge>(databaseManager, "HueDiscoveredBridge");
    }
  }

  async pairBridge(bridgeId: string): Promise<boolean> {
    if (!this.bridgeRepository) return false;
    const bridge = this.bridgeRepository.findById(bridgeId);
    if (!bridge) return false;
    const ipAddress = bridge.ipAddress;
    if (!ipAddress) return false;

    try {
      const unauthenticatedApi = await v3.api.createLocal(ipAddress).connect();
      const createdUser = await unauthenticatedApi.users.createUser("smarthome-backend", "server");
      bridge.isPaired = true;
      bridge.username = createdUser.username;
      bridge.clientKey = createdUser.clientkey;
      this.bridgeRepository.save(bridgeId, bridge);
      return true;
    } catch (err: unknown) {
      logger.warn({ err }, "Hue Pairing fehlgeschlagen für {} ({})", bridgeId, err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  createEventStreamManagers(actionManager: ActionManager | undefined): ModuleEventStreamManager[] {
    const managers: ModuleEventStreamManager[] = [];
    if (!this.bridgeRepository || !this.databaseManager || !actionManager) {
      logger.warn(
        "Kann EventStreamManager nicht erstellen: bridgeRepository, databaseManager oder actionManager ist null"
      );
      return managers;
    }
    const bridges = this.bridgeRepository.findAll();
    bridges.forEach(bridge => {
      if (!bridge?.bridgeId) return;
      if (!bridge.isPaired) return;
      if (!bridge.username) return;
      try {
        managers.push(
          new HueModuleEventStreamManager(bridge.bridgeId, actionManager, this.databaseManager)
        );
        logger.info("EventStreamManager fuer gepaarte Bridge {} erstellt", bridge.bridgeId);
      } catch (err) {
        logger.error({ err, bridgeId: bridge.bridgeId }, "Fehler beim Erstellen des EventStreamManagers");
      }
    });
    return managers;
  }
}
