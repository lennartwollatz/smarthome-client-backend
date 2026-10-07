/** POST /api/modules/lg/devices/:deviceId/screenOff */
export class Request_LgScreenOff {
  readonly deviceId!: string;

  constructor(fields: Request_LgScreenOff) {
    Object.assign(this, fields);
  }
}
