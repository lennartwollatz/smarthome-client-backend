/** POST /api/modules/bmw/devices/:deviceId/refresh */
export class Request_BmwRefreshDevice {
  readonly deviceId!: string;

  constructor(fields: Request_BmwRefreshDevice) {
    Object.assign(this, fields);
  }
}
