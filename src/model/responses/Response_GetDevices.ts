import type { Response_Device } from "./Response_Device.js";

/** GET /api/devices – Antwort ist das Geräte-Array ohne Sprachassistenten. */
export class Response_GetDevices {
  constructor(readonly devices: Response_Device[]) {}

  toJSON(): Response_Device[] {
    return this.devices;
  }
}
