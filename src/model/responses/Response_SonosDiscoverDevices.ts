import type { Device } from "../devices/Device.js";

/** GET /api/modules/sonos/devices/discover – Antwort ist das Array der gefundenen Geräte. */
export class Response_SonosDiscoverDevices {
  constructor(readonly devices: Device[]) {}

  toJSON(): Device[] {
    return this.devices;
  }
}
