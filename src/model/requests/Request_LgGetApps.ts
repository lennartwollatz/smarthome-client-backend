/** GET /api/modules/lg/devices/:deviceId/apps */
export class Request_LgGetApps {
  readonly deviceId!: string;

  constructor(fields: Request_LgGetApps) {
    Object.assign(this, fields);
  }
}
