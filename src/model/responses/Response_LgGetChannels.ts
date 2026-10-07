import type { Channel } from "../devices/DeviceTV.js";

/** GET /api/modules/lg/devices/:deviceId/channels – Antwort ist das Array der Kanäle. */
export class Response_LgGetChannels {
  constructor(readonly channels: Channel[]) {}

  toJSON(): Channel[] {
    return this.channels;
  }
}
