/** POST /api/modules/bmw/devices/:deviceId/climate/stop */
export class Request_BmwStopClimateControl {
  readonly deviceId!: string;

  constructor(fields: Request_BmwStopClimateControl) {
    Object.assign(this, fields);
  }
}
