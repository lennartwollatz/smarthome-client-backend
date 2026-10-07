import { ModuleEvent } from "../moduleEvent.js";

export interface XiaomiEvent extends ModuleEvent {
    deviceid: string,
    data: { type: string; value: unknown }
}

