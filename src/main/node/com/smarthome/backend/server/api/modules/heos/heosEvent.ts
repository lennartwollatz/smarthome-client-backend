import { ModuleEvent } from "../moduleEvent.js";

export interface HeosEvent extends ModuleEvent {
    deviceid: string,
    data: { type: string; value: unknown }
}

