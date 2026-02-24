import type { ModuleDeviceDiscovered } from "../moduleDeviceDiscovered.js";

/**
 * Repräsentiert einen CalDAV Kalender als "Discovered Device".
 * `address` enthält die Kalender-Collection URL.
 */
export class AppleCalendarDeviceDiscovered implements ModuleDeviceDiscovered {
  id: string;
  name: string;
  address: string;
  port: number;

  constructor(init: { id: string; name: string; address: string; port: number }) {
    this.id = init.id;
    this.name = init.name;
    this.address = init.address;
    this.port = init.port;
  }
}


