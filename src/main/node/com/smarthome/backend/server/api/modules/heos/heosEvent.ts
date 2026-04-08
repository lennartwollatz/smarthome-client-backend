import { ModuleEvent } from "../moduleEvent.js";

/** Geparster HEOS-Payload wie im TCP-Stream (Felder aus `JSON.parse` der Zeile). */
export interface HeosEventHeos {
  command: string;
  message?: string;
}

export interface HeosEvent extends ModuleEvent {
  deviceid: string;
  data: {
    heos: HeosEventHeos;
  };
}

