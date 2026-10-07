import type { DatabaseManager } from "../db/database.js";
import { logger } from "../config/logger.js";
import { ModuleBridgeDiscovered } from "./moduleBridgeDiscovered.js";
import { BridgeRepository } from "../db/repositories/BridgeRepository.js";

/**
 * Abstrakte Basisklasse für Bridge-Controller.
 * Bridges sind spezielle Geräte, die andere Geräte verwalten (z.B. Hue Bridge).
 * 
 * @template DB - Der Typ der BridgeDiscovered (muss ModuleDeviceDiscovered implementieren)
 * @template DC - Der Typ des DeviceControllers, der mit dieser Bridge verwendet wird
 */
export abstract class ModuleBridgeController<BD extends ModuleBridgeDiscovered> {
  private repository: BridgeRepository<BD>;

  constructor(databaseManager: DatabaseManager) {
    this.repository = new BridgeRepository<BD>(databaseManager, this.getDiscoveredBridgeTypeName());
  }


  protected abstract getDiscoveredBridgeTypeName(): string;
  protected abstract getModuleName(): string;

  /**
   * Paart eine Bridge mit dem System.
   * @param bridgeId - Die ID der Bridge
   * @returns true wenn die Bridge gepaart ist, false sonst
   */
  public async pair(bridgeId: string): Promise<boolean> {
    let bridge = await this.findBridgeById(bridgeId);
    if (!bridge) return false;
    let pairedBridge = await this.pairBridge(bridge);
    if( pairedBridge ) {
      await this.saveBridge(pairedBridge);
      logger.info(this.getModuleName()+" Paired Bridge: "+JSON.stringify(pairedBridge));
      return true;
    }
    return false;
  }

  /**
   * Paart eine Bridge mit dem System.
   * Die konkrete Implementierung muss das spezifische Pairing-Protokoll der Bridge umsetzen.
   * 
   * @param bridge - Die Bridge, die gepaart werden soll
   * @returns true wenn das Pairing erfolgreich war, false sonst
   */
  protected abstract pairBridge(bridge: BD): Promise<BD | null>;


  /**
   * Validiert, ob eine Bridge gepaart ist.
   * Diese Methode kann von Unterklassen überschrieben werden, um spezifische Validierungen durchzuführen.
   * 
   * @param bridgeid - Die ID der Bridge
   * @returns true wenn die Bridge gepaart ist, false sonst
   */
  protected async isBridgePaired(bridgeid:string): Promise<boolean> {
    const bridge = await this.repository.findById(bridgeid);
    return bridge?.isPaired ?? false;
  }

 /**
   * Findet eine Bridge anhand ihrer ID.
   * 
   * @param bridgeId - Die ID der Bridge
   * @returns Die Bridge oder null, wenn nicht gefunden
   */
  protected async findBridgeById(bridgeId: string): Promise<BD | null> {
    return this.repository.findById(bridgeId);
  }

  /**
   * Speichert eine Bridge.
   * 
   * @param bridge - Die Bridge, die gespeichert werden soll
   */
  protected async saveBridge(bridge: BD): Promise<void> {
    await this.repository.save(bridge);
  }
}

