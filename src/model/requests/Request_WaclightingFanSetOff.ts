/** POST /api/modules/waclighting/devices/:deviceId/fan/setOff */
export class Request_WaclightingFanSetOff {
  readonly deviceId!: string;

  constructor(fields: Request_WaclightingFanSetOff) {
    Object.assign(this, fields);
  }
}
