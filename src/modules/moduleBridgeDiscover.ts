import { logger } from "../config/logger.js";
import { DatabaseManager } from "../db/database.js";
import { BridgeRepository } from "../db/repositories/BridgeRepository.js";
import { ModuleBridgeDiscovered } from "./moduleBridgeDiscovered.js";


export abstract class ModuleBridgeDiscover<DB extends ModuleBridgeDiscovered> {
  private repository: BridgeRepository<DB>;

  constructor(databaseManager: DatabaseManager) {
    this.repository = new BridgeRepository<DB>(databaseManager, this.getDiscoveredBridgeTypeName());
  }

  public abstract getDiscoveredBridgeTypeName(): string;
  public abstract getModuleName(): string;
  protected abstract startDiscovery(timeoutSeconds: number): Promise<DB[]>;
  protected abstract stopDiscovery(): Promise<void>;
  
  public async getBridge(bridgeId:string): Promise<DB | null> {
    return this.repository.findById(bridgeId);
  }

  public async getBridges(): Promise<DB[]> {
    return this.repository.findAll();
  }

  /**
   * Entdeckt Bridges im Netzwerk.
   * Standardimplementierung ruft discover() mit 5 Sekunden Timeout auf.
   * Kann in abgeleiteten Klassen überschrieben werden.
   * 
   * @param timeoutSeconds - Die Zeit in Sekunden, die für die Discovery verwendet wird
   * @returns Array der entdeckten Bridges
   */
  public async discover(timeoutSeconds: number): Promise<DB[]>{
    logger.info("Starte Discovery fuer "+this.getModuleName());
    let bridges = await this.startDiscovery(timeoutSeconds);
    await this.stopDiscovery();
    for (const bridge of bridges) {
      await this.repository.save(bridge);
      logger.info(this.getModuleName()+" Discovered Device: "+JSON.stringify(bridge));
    }
    return bridges;
  }

  public async findChangedIPAddressForBridge(bridge: DB): Promise<DB> {
    const bridges = await this.startDiscovery(5);
    const newBridge = bridges.find(b => b.id === bridge.id);
    return newBridge ?? bridge;
  }

}

