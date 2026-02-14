import { ModuleDeviceController } from "./moduleDeviceController.js";
import { ModuleEvent } from "./moduleEvent.js";
import { ModuleEventStreamManager } from "./moduleEventStreamManager.js";
import { ModuleDeviceDiscover } from "./moduleDeviceDiscover.js";
import { ModuleDeviceDiscovered } from "./moduleDeviceDiscovered.js";
import { ModuleManager } from "./moduleManager.js";
import { Device } from "../../../model/devices/Device.js";
import { DatabaseManager } from "../../db/database.js";
import { ActionManager } from "../../actions/actionManager.js";
import { ModuleBridgeDiscovered } from "./moduleBridgeDiscovered.js";
import { ModuleBridgeDiscover } from "./moduleBridgeDiscover.js";
import { ModuleBridgeControllerEvent } from "./moduleBridgeControllerEvent.js";
import { ModuleEventController } from "./moduleEventController.js";
import { EventStreamManager } from "../../events/eventStreamManager.js";

export abstract class ModuleManagerBridged<EM extends ModuleEventStreamManager<C, E>, C extends ModuleEventController, DC extends ModuleDeviceController<E, D>, E extends ModuleEvent, D extends Device, DD extends ModuleDeviceDiscover<DS>, DS extends ModuleDeviceDiscovered, BC extends ModuleBridgeControllerEvent<BS, E>, BD extends ModuleBridgeDiscover<BS>, BS extends ModuleBridgeDiscovered> extends ModuleManager<EM, C, DC, E, D, DD, DS> {
  protected bridgeDiscover: BD;
  protected bridgeController: BC;

  constructor(databaseManager: DatabaseManager, actionManager: ActionManager, eventStreamManager: EventStreamManager, deviceController: DC, deviceDiscover: DD, bridgeController: BC, bridgeDiscover: BD) {
    super(databaseManager, actionManager, eventStreamManager, deviceController, deviceDiscover, false);
    this.bridgeDiscover = bridgeDiscover;
    this.bridgeController = bridgeController;
    this.initialiseEventStreamManager();
  }

}