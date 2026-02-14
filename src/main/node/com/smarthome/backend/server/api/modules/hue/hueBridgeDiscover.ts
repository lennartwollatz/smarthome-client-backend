import { logger } from "../../../../logger.js";
import type { DatabaseManager } from "../../../db/database.js";
import { HueBridgeDiscovered } from "./hueBridgeDiscovered.js";
import { v3 } from "node-hue-api";
import { ModuleBridgeDiscover } from "../moduleBridgeDiscover.js";
import { HUEMODULE } from "./hueModule.js";

export class HueBridgeDiscover extends ModuleBridgeDiscover<HueBridgeDiscovered> {

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  getModuleName(): string {
    return HUEMODULE.id;
  }

  getDiscoveredBridgeTypeName(): string {
    return "HueBridgeDiscovered";
  }

  private generateDeviceId(entry: any) {
    const address = entry.ipaddress;
    const normalized = address.replace(/[.:]/g, "-");
    return `hue-bridge-${normalized}`;
  }

  protected copyBridgeProperties(existing: HueBridgeDiscovered, bridge: HueBridgeDiscovered): void {
    bridge.isPaired = existing.isPaired;
    bridge.username = existing.username;
    bridge.clientKey = existing.clientKey;
    bridge.devices = existing.devices;
  }

  protected async startDiscovery(timeoutSeconds: number): Promise<HueBridgeDiscovered[]> {
    const results = await v3.discovery.nupnpSearch();
    let bridges:HueBridgeDiscovered[] = [];
    
    results.forEach((entry: any) => {
      const ipAddress = entry.ipaddress;
      if (!ipAddress) return;
      const bridgeId = this.generateDeviceId(entry);
      const bridgeName = entry.name ?? "Hue Bridge";
      const modelId = entry.modelid ?? "Unknown";
      const softwareVersion = entry.swversion ?? "Unknown";
      const bridge = new HueBridgeDiscovered(bridgeId, bridgeName, ipAddress, modelId, softwareVersion, 80);
      bridges.push(bridge);
    });

    return bridges;
  }

  protected async stopDiscovery(): Promise<void> {
    return;
  }
}

