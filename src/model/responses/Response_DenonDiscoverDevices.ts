import type { Device } from "../devices/Device.js";

/** GET /api/modules/denon/devices/discover – Antwort ist das Array der gefundenen Geräte. */
export class Response_DenonDiscoverDevices {
  constructor(readonly devices: Device[]) {}

  toJSON(): Device[] {
    return this.devices;
  }
}
