/** POST /api/modules/lg/devices/:deviceId/screenOn */
export class Request_LgScreenOn {
  readonly deviceId!: string;

  constructor(fields: Request_LgScreenOn) {
    Object.assign(this, fields);
  }
}
