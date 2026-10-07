import type { Device } from "../devices/Device.js";

/** Gerät in seiner JSON-Darstellung (`Device.toJSON()`), wie es die Geräte-Endpunkte zurückgeben. */
export class Response_Device {
  constructor(readonly device: Device) {}

  toJSON(): Record<string, unknown> {
    return this.device.toJSON();
  }
}
