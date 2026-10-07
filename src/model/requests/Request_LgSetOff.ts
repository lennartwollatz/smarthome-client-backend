/** POST /api/modules/lg/devices/:deviceId/setOff */
export class Request_LgSetOff {
  readonly deviceId!: string;

  constructor(fields: Request_LgSetOff) {
    Object.assign(this, fields);
  }
}
