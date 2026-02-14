import { ModuleEvent } from "../moduleEvent.js";

export interface MatterEvent extends ModuleEvent {
    nodeId?: string | number,
    deviceId?: string,
    event?: string,
    name?: string,
    online?: boolean,
    isOnline?: boolean,
    reachable?: boolean,
    payload?: Record<string, unknown>
  }