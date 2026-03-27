import type { DatabaseManager } from "../../db/database.js";
import { ModuleEvent } from "./moduleEvent.js";
import { ModuleDeviceDiscover } from "./moduleDeviceDiscover.js";
import { Device } from "../../../model/devices/Device.js";
import { ModuleDeviceDiscovered } from "./moduleDeviceDiscovered.js";
import { ModuleEventStreamManager } from "./moduleEventStreamManager.js";
import { ModuleEventController } from "./moduleEventController.js";
import { ModuleDeviceController } from "./moduleDeviceController.js";
import { EventManager } from "../../events/EventManager.js";
import { DeviceManager } from "../entities/devices/deviceManager.js";


export abstract class ModuleManager<EM extends ModuleEventStreamManager<C, E>, C extends ModuleEventController, DC extends ModuleDeviceController<E, D>, E extends ModuleEvent, D extends Device, DD extends ModuleDeviceDiscover<DS>, DS extends ModuleDeviceDiscovered> {
  protected databaseManager: DatabaseManager;
  protected deviceManager: DeviceManager;
  protected eventManager: EventManager;
  protected deviceController: DC;
  protected deviceDiscover: DD;
  protected eventStreamManager!: EM;

  
  constructor(databaseManager: DatabaseManager, deviceManager: DeviceManager, eventManager: EventManager, deviceController: DC, deviceDiscover: DD) {
    this.databaseManager = databaseManager;
    this.deviceManager = deviceManager;
    this.eventManager = eventManager;
    this.deviceController = deviceController;
    this.deviceDiscover = deviceDiscover;
  }

  /**
   * Event-Streams erst starten, nachdem ActionManager.registerModuleManager die Geräte aus der DB
   * in die Modul-Device-Klassen konvertiert hat. Sonst liefern getDevicesForModule noch reine JSON-Objekte
   * ohne Prototyp-Methoden (z. B. Matter getNodeId).
   */
  public startEventStreamsAfterRegistration(): void {
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

  public restartEventStream(): void {
    this.initialiseEventStreamManager();
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

  /**
   * Aktualisiert die Werte für alle Devices dieses Moduls.
   * Diese Methode wird nach der Initialisierung der Controller aufgerufen.
   * Nach dem Aktualisieren der Werte werden die Devices im DeviceManager gespeichert.
   */
  public async updateDeviceValues(): Promise<void>{
    const devices = this.deviceManager.getDevicesForModule(this.getModuleId());
    const updatePromises: Promise<void>[] = [];
    devices.forEach(device => {
      updatePromises.push(device.updateValues());
    });
    return Promise.all(updatePromises).then(() => {
      devices.forEach(device => {
        this.deviceManager.saveDevice(device);
      });
    });
  }

}

