import { Device } from "../../../model/devices/Device.js";
import { ModuleDeviceController } from "./moduleDeviceController.js";
import { ModuleEvent } from "./moduleEvent.js";
import { ModuleEventDeviceController } from "./moduleEventDeviceController.js";

export abstract class ModuleDeviceControllerEvent<E extends ModuleEvent, D extends Device> extends ModuleDeviceController<E, D> implements ModuleEventDeviceController<E, D> {
  abstract startEventStream(device: D, callback: (event: E) => void): Promise<void>;
  abstract stopEventStream(device: D): Promise<void>;
}