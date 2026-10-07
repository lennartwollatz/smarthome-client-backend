import type { MatterDeviceDiscovered } from "../../modules/matter/matterDeviceDiscovered.js";

/** GET /api/modules/matter/devices/discover – Antwort ist das Array der gefundenen Geräte. */
export class Response_MatterDiscoverDevices {
  constructor(readonly devices: MatterDeviceDiscovered[]) {}

  toJSON(): MatterDeviceDiscovered[] {
    return this.devices;
  }
}
