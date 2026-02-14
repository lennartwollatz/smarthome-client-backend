import { ModuleEvent } from "../moduleEvent.js";

export interface LGEvent extends ModuleEvent {
    deviceid: string,
    data: { type: string; value: unknown }
}

