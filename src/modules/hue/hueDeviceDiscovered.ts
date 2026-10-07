import { ModuleDeviceDiscovered } from "../moduleDeviceDiscovered.js";

export interface HueDeviceDiscovered extends ModuleDeviceDiscovered {
  id: string;
  name: string;
  address: string;
  port: number;
}

