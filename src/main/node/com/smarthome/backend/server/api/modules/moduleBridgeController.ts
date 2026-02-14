import type { DatabaseManager } from "../../db/database.js";
import { logger } from "../../../logger.js";
import { ModuleBridgeDiscovered } from "./moduleBridgeDiscovered.js";
import { JsonRepository } from "../../db/jsonRepository.js";

/**
 * Abstrakte Basisklasse für Bridge-Controller.
 * Bridges sind spezielle Geräte, die andere Geräte verwalten (z.B. Hue Bridge).
 * 
 * @template DB - Der Typ der BridgeDiscovered (muss ModuleDeviceDiscovered implementieren)
 * @template DC - Der Typ des DeviceControllers, der mit dieser Bridge verwendet wird
 */
export abstract class ModuleBridgeController<BD extends ModuleBridgeDiscovered> {
  private repository: JsonRepository<BD>;

  constructor(databaseManager: DatabaseManager) {
    this.repository = new JsonRepository<BD>(databaseManager, this.getDiscoveredBridgeTypeName());
  }


  protected abstract getDiscoveredBridgeTypeName(): string;
  protected abstract getModuleName(): string;

  /**
   * Paart eine Bridge mit dem System.
   * @param bridgeId - Die ID der Bridge
   * @returns true wenn die Bridge gepaart ist, false sonst
   */
  public async pair(bridgeId: string): Promise<boolean> {
    let bridge = this.findBridgeById(bridgeId);
    if (!bridge) return false;
    let pairedBridge = await this.pairBridge(bridge);
    if( pairedBridge ) {
      this.repository.save(pairedBridge.id, pairedBridge);
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
  protected isBridgePaired(bridgeid:string): boolean {
    return this.repository.findById(bridgeid)?.isPaired ?? false;
  }

 /**
   * Findet eine Bridge anhand ihrer ID.
   * 
   * @param bridgeId - Die ID der Bridge
   * @returns Die Bridge oder null, wenn nicht gefunden
   */
  protected findBridgeById(bridgeId: string): BD | null {
    return this.repository.findById(bridgeId) ?? null;
  }

  /**
   * Speichert eine Bridge.
   * 
   * @param bridgeId - Die ID der Bridge
   * @param bridge - Die Bridge, die gespeichert werden soll
   */
  protected saveBridge(bridgeId: string, bridge: BD): void {
    this.repository.save(bridgeId, bridge);
  }
}

