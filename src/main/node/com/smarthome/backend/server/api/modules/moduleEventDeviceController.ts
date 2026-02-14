import { Device } from "../../../model/devices/Device.js";
import { ModuleEvent } from "./moduleEvent.js";
import { ModuleEventController } from "./moduleEventController.js";

export interface ModuleEventDeviceController<E extends ModuleEvent, D extends Device> extends ModuleEventController {
  startEventStream(device: D, callback: (event: E) => void): Promise<void>;
  stopEventStream(device: D): Promise<void>;
}

