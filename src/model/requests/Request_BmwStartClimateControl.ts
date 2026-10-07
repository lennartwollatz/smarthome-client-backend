/** POST /api/modules/bmw/devices/:deviceId/climate/start */
export class Request_BmwStartClimateControl {
  readonly deviceId!: string;

  constructor(fields: Request_BmwStartClimateControl) {
    Object.assign(this, fields);
  }
}
