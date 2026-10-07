import type { App } from "../devices/DeviceTV.js";

/** GET /api/modules/lg/devices/:deviceId/apps – Antwort ist das Array der Apps. */
export class Response_LgGetApps {
  constructor(readonly apps: App[]) {}

  toJSON(): App[] {
    return this.apps;
  }
}
