import type { DatabaseManager } from "../../db/database.js";
import type { ActionManager } from "../../actions/actionManager.js";
import { ModuleEvent } from "./moduleEvent.js";
import { ModuleDeviceDiscover } from "./moduleDeviceDiscover.js";
import { Device } from "../../../model/devices/Device.js";
import { ModuleDeviceDiscovered } from "./moduleDeviceDiscovered.js";
import { ModuleEventStreamManager } from "./moduleEventStreamManager.js";
import { ModuleEventController } from "./moduleEventController.js";
import { ModuleDeviceController } from "./moduleDeviceController.js";
import { EventStreamManager } from "../../events/eventStreamManager.js";


export abstract class ModuleManager<EM extends ModuleEventStreamManager<C, E>, C extends ModuleEventController, DC extends ModuleDeviceController<E, D>, E extends ModuleEvent, D extends Device, DD extends ModuleDeviceDiscover<DS>, DS extends ModuleDeviceDiscovered> {
  protected databaseManager: DatabaseManager;
  protected actionManager: ActionManager;
  protected eventStreamManager: EventStreamManager;
  protected deviceController: DC;
  protected deviceDiscover: DD;

  
  constructor(databaseManager: DatabaseManager, actionManager: ActionManager, eventStreamManager: EventStreamManager, deviceController: DC, deviceDiscover: DD, initaliseEventStream:boolean = true) {
    this.databaseManager = databaseManager;
    this.actionManager = actionManager;
    this.eventStreamManager = eventStreamManager;
    this.deviceController = deviceController;
    this.deviceDiscover = deviceDiscover;
    if( initaliseEventStream ) {
      this.initialiseEventStreamManager();
    }
  }

  protected initialiseEventStreamManager(): void {
    this.eventStreamManager.registerModuleEventStreamManager(this.createEventStreamManager());
  }

  protected abstract createEventStreamManager(): EM;
  public abstract getModuleId(): string;
  protected abstract getManagerId(): string;

  /**
   * Konvertiert ein Device-Objekt aus der Datenbank in die entsprechende Device-Klasse des Moduls.
   * @param device Das Device-Objekt aus der Datenbank
   * @returns Das konvertierte Device oder null, wenn das Device nicht zu diesem Modul gehört
   */
  abstract convertDeviceFromDatabase(device: Device): Device | null;

  /**
   * Initialisiert die Controller für alle Devices dieses Moduls, die bereits im ActionManager geladen sind.
   * Diese Methode wird nach der Registrierung des Moduls aufgerufen.
   * Nach dem Setzen der Controller werden updateValues() für alle betroffenen Devices aufgerufen.
   */
  abstract initializeDeviceControllers(): Promise<void>;

}

