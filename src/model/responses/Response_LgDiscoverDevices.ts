import type { Device } from "../devices/Device.js";

/** GET /api/modules/lg/devices/discover – Antwort ist das Array der gefundenen Fernseher. */
export class Response_LgDiscoverDevices {
  constructor(readonly devices: Device[]) {}

  toJSON(): Device[] {
    return this.devices;
  }
}
