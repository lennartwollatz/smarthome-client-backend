import { ModuleEvent } from "../moduleEvent.js";

export interface HueEvent extends ModuleEvent {
    bridgeId: string;
    data: Record<string, unknown>;
}

