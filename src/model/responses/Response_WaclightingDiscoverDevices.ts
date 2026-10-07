import type { Device } from "../devices/Device.js";

/** GET /api/modules/waclighting/devices/discover – Antwort ist das Array der gefundenen Geräte. */
export class Response_WaclightingDiscoverDevices {
  constructor(readonly devices: Device[]) {}

  toJSON(): Device[] {
    return this.devices;
  }
}
