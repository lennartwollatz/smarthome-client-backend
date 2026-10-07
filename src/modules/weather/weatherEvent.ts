import { ModuleEvent } from "../moduleEvent.js";

export interface WeatherEvent extends ModuleEvent {
  deviceid: string;
  data: {
    type: string;
    value: unknown;
  };
}
