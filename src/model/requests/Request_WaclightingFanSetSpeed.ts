/** POST /api/modules/waclighting/devices/:deviceId/fan/setSpeed */
export class Request_WaclightingFanSetSpeed {
  readonly deviceId!: string;
  readonly speed?: number | null;

  constructor(fields: Request_WaclightingFanSetSpeed) {
    Object.assign(this, fields);
  }
}
