import { ModuleEvent } from "../moduleEvent.js";

export interface WACLightingEvent extends ModuleEvent {
    deviceid: string,
    data: { type: string; value: any }
}

