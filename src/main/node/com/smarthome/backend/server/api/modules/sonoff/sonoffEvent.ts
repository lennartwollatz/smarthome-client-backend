import { ModuleEvent } from "../moduleEvent.js";

export interface SonoffEvent extends ModuleEvent {
  deviceId?: string;
  ewelinkDeviceId?: string;
  event?: string;
  name?: string;
  online?: boolean;
  reachable?: boolean;
  payload?: Record<string, unknown>;
}
