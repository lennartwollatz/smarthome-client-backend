/** POST /api/modules/lg/devices/:deviceId/setOn */
export class Request_LgSetOn {
  readonly deviceId!: string;

  constructor(fields: Request_LgSetOn) {
    Object.assign(this, fields);
  }
}
