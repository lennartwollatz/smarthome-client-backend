import type { Device } from "../devices/Device.js";

/** GET /api/modules/hue/discover/devices/:bridgeId – Antwort ist das Array der gefundenen Geräte. */
export class Response_HueDiscoverBridgeDevices {
  constructor(readonly devices: Device[]) {}

  toJSON(): Device[] {
    return this.devices;
  }
}
