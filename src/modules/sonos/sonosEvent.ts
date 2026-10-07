import { ModuleEvent } from "../moduleEvent.js";

export interface SonosEvent extends ModuleEvent {
    deviceid:string,
    data:{ type: string; value: unknown }
}