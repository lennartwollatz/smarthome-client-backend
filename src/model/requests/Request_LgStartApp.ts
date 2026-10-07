/** POST /api/modules/lg/devices/:deviceId/startApp */
export class Request_LgStartApp {
  readonly deviceId!: string;
  readonly appId?: string | null;

  constructor(fields: Request_LgStartApp) {
    Object.assign(this, fields);
  }
}
