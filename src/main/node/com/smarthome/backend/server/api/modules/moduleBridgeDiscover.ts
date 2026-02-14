import { logger } from "../../../logger.js";
import { DatabaseManager } from "../../db/database.js";
import { JsonRepository } from "../../db/jsonRepository.js";
import { ModuleBridgeDiscovered } from "./moduleBridgeDiscovered.js";


export abstract class ModuleBridgeDiscover<DB extends ModuleBridgeDiscovered> {
  private repository: JsonRepository<DB>;

  constructor(databaseManager: DatabaseManager) {
    this.repository = new JsonRepository<DB>(databaseManager, this.getDiscoveredBridgeTypeName());
  }

  public abstract getDiscoveredBridgeTypeName(): string;
  public abstract getModuleName(): string;
  protected abstract startDiscovery(timeoutSeconds: number): Promise<DB[]>;
  protected abstract stopDiscovery(): Promise<void>;
  
  public getBridge(bridgeId:string): DB | null {
    return this.repository.findById(bridgeId) ?? null;
  }

  public getBridges(): DB[] {
    return this.repository.findAll() ?? [];
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
    bridges.forEach(bridge => {
      this.repository.save(bridge.id, bridge);
      logger.info(this.getModuleName()+" Discovered Device: "+JSON.stringify(bridge));
    });
    return bridges;

  }

}

