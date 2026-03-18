import { ModuleDeviceDiscovered } from "../moduleDeviceDiscovered.js";

export interface WeatherDeviceDiscovered extends ModuleDeviceDiscovered {
  latitude?: number;
  longitude?: number;
}
