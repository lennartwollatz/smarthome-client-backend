import { ModuleEvent } from "../moduleEvent.js";
import { OpenMeteoResponse } from "./weatherDeviceController.js";

export interface WeatherEvent extends ModuleEvent {
  deviceid: string;
  data: OpenMeteoResponse;
}
