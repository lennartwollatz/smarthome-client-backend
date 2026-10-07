/** GET /api/modules/lg/devices/:deviceId/channels */
export class Request_LgGetChannels {
  readonly deviceId!: string;

  constructor(fields: Request_LgGetChannels) {
    Object.assign(this, fields);
  }
}
