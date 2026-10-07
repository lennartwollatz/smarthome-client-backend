import type { DeviceVacuumCleaner } from "../devices/DeviceVacuumCleaner.js";

/** POST /api/modules/xiaomi/devices/add – Antwort ist der hinzugefügte Staubsauger. */
export class Response_XiaomiAddDevice {
  constructor(readonly device: DeviceVacuumCleaner) {}

  toJSON(): Record<string, unknown> {
    return this.device.toJSON();
  }
}
