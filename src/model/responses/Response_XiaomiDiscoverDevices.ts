import type { Device } from "../devices/Device.js";

/** GET /api/modules/xiaomi/devices/discover – Antwort ist das Array der gefundenen Staubsauger. */
export class Response_XiaomiDiscoverDevices {
  constructor(readonly devices: Device[]) {}

  toJSON(): Device[] {
    return this.devices;
  }
}
