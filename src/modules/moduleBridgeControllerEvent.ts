import { ModuleBridgeController } from "./moduleBridgeController.js";
import { ModuleBridgeDiscovered } from "./moduleBridgeDiscovered.js";
import { ModuleEvent } from "./moduleEvent.js";
import { ModuleEventBridgeController } from "./moduleEventBridgeController.js";

export abstract class ModuleBridgeControllerEvent<BD extends ModuleBridgeDiscovered, E extends ModuleEvent> extends ModuleBridgeController<BD> implements ModuleEventBridgeController<E, BD> {
  abstract startEventStream(bridge: BD, callback: (event: E) => void): Promise<void>;
  abstract stopEventStream(bridge: BD): Promise<void>;
}