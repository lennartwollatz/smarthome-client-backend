import { Response_Success } from "./Response_Success.js";

/** POST /api/modules/matter/devices/:deviceId/pair – Matter-Node und ID des angelegten Geräts. */
export class Response_MatterPairDevice extends Response_Success {
  constructor(
    readonly nodeId?: string | number | bigint | boolean,
    readonly deviceId?: string
  ) {
    super();
  }
}
