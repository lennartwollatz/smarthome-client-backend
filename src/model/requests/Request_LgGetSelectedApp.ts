/** GET /api/modules/lg/devices/:deviceId/selectedApp */
export class Request_LgGetSelectedApp {
  readonly deviceId!: string;

  constructor(fields: Request_LgGetSelectedApp) {
    Object.assign(this, fields);
  }
}
