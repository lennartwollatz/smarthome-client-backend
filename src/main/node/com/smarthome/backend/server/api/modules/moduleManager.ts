import type { DatabaseManager } from "../../db/database.js";
import type { ActionManager } from "../../actions/ActionManager.js";
import { ModuleEvent } from "./moduleEvent.js";
import { ModuleDeviceDiscover } from "./moduleDeviceDiscover.js";
import { Device } from "../../../model/devices/Device.js";
import { ModuleDeviceDiscovered } from "./moduleDeviceDiscovered.js";
import { ModuleEventStreamManager } from "./moduleEventStreamManager.js";
import { ModuleEventController } from "./moduleEventController.js";
import { ModuleDeviceController } from "./moduleDeviceController.js";
import { EventManager } from "../../events/EventManager.js";


export abstract class ModuleManager<EM extends ModuleEventStreamManager<C, E>, C extends ModuleEventController, DC extends ModuleDeviceController<E, D>, E extends ModuleEvent, D extends Device, DD extends ModuleDeviceDiscover<DS>, DS extends ModuleDeviceDiscovered> {
  protected databaseManager: DatabaseManager;
  protected actionManager: ActionManager;
  protected eventManager: EventManager;
  protected deviceController: DC;
  protected deviceDiscover: DD;
  protected eventStreamManager!: EM;

  
  constructor(databaseManager: DatabaseManager, actionManager: ActionManager, eventManager: EventManager, deviceController: DC, deviceDiscover: DD) {
    this.databaseManager = databaseManager;
    this.actionManager = actionManager;
    this.eventManager = eventManager;
    this.deviceController = deviceController;
    this.deviceDiscover = deviceDiscover;
    this.initialiseEventStreamManager();
  }


  public abstract getModuleId(): string;
  protected abstract getManagerId(): string
  protected abstract createEventStreamManager(): EM;

  protected initialiseEventStreamManager(): void {
    if( this.eventStreamManager && this.eventStreamManager.isRunning() ) {
      this.eventStreamManager.stop();
    }
    this.eventStreamManager = this.createEventStreamManager();
    this.eventStreamManager.start();
  }

  /**
   * Konvertiert ein Device-Objekt aus der Datenbank in die entsprechende Device-Klasse des Moduls.
   * @param device Das Device-Objekt aus der Datenbank
   * @returns Das konvertierte Device oder null, wenn das Device nicht zu diesem Modul gehört
   */
  abstract convertDeviceFromDatabase(device: Device): Promise<Device | null>;

  /**
   * Initialisiert die Controller für alle Devices dieses Moduls, die bereits im ActionManager geladen sind.
   * Diese Methode wird nach der Registrierung des Moduls aufgerufen.
   * Nach dem Setzen der Controller werden updateValues() für alle betroffenen Devices aufgerufen.
   */
  abstract initializeDeviceControllers(): Promise<void>;

}

