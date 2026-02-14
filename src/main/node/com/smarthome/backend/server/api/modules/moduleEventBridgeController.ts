import { ModuleBridgeDiscovered } from "./moduleBridgeDiscovered.js";
import { ModuleEvent } from "./moduleEvent.js";
import { ModuleEventController } from "./moduleEventController.js";

export interface ModuleEventBridgeController<E extends ModuleEvent, BD extends ModuleBridgeDiscovered> extends ModuleEventController {
  startEventStream(bridge: BD, callback: (event: E) => void): Promise<void>;
  stopEventStream(bridge: BD): Promise<void>;
}

