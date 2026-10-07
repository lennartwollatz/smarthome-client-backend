import type { Device } from "../devices/Device.js";

/** GET /api/modules/bmw/devices/discover – Antwort ist das Array der gefundenen Fahrzeuge. */
export class Response_BmwDiscoverDevices {
  constructor(readonly devices: Device[]) {}

  toJSON(): Device[] {
    return this.devices;
  }
}
