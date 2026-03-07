import type { DatabaseManager } from "../../../db/database.js";
import type { ActionManager } from "../../../actions/ActionManager.js";
import { ModuleManager } from "../moduleManager.js";
import { HeosDeviceController } from "./heosDeviceController.js";
import { HeosDeviceDiscovered } from "./heosDeviceDiscovered.js";
import { HeosDeviceDiscover } from "./heosDeviceDiscover.js";
import { DeviceSpeaker } from "../../../../model/devices/DeviceSpeaker.js";
import { Device } from "../../../../model/devices/Device.js";
import { HeosEvent } from "./heosEvent.js";
import { HeosEventStreamManager } from "./heosEventStreamManager.js";
import { EventManager } from "../../../events/EventManager.js";

// HeosModuleManager ist abstrakt und wird von konkreten Implementierungen wie DenonModuleManager erweitert
export abstract class HeosModuleManager extends ModuleManager<HeosEventStreamManager, HeosDeviceController, HeosDeviceController, HeosEvent, DeviceSpeaker, HeosDeviceDiscover, HeosDeviceDiscovered> {

  constructor(
    databaseManager: DatabaseManager,
    actionManager: ActionManager,
    eventManager: EventManager,
    deviceDiscover: HeosDeviceDiscover
  ) {
    const controller = new HeosDeviceController();
    super(
      databaseManager,
      actionManager,
      eventManager,
      controller,
      deviceDiscover
    );
  }

  abstract discoverDevices(): Promise<Device[]>;
}

