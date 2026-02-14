import { ModuleEvent } from "../moduleEvent.js";

export interface BMWEvent extends ModuleEvent {
  deviceid: string;
  data: { type: string; value: unknown };
}

