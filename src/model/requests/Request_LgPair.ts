/** POST /api/modules/lg/devices/:deviceId/pair */
export class Request_LgPair {
  readonly deviceId!: string;

  constructor(fields: Request_LgPair) {
    Object.assign(this, fields);
  }
}
