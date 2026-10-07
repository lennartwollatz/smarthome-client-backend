/** POST /api/modules/waclighting/devices/:deviceId/fan/setOn */
export class Request_WaclightingFanSetOn {
  readonly deviceId!: string;

  constructor(fields: Request_WaclightingFanSetOn) {
    Object.assign(this, fields);
  }
}
