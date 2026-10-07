import type { Device } from "../devices/Device.js";
import { Response_Success } from "./Response_Success.js";

/** POST /api/modules/lg/devices/:deviceId/pair – `device` fehlt, wenn das Gerät nicht registriert ist. */
export class Response_LgPair extends Response_Success {
  constructor(readonly device?: Device) {
    super();
  }
}
