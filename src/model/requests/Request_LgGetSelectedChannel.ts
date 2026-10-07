/** GET /api/modules/lg/devices/:deviceId/selectedChannel */
export class Request_LgGetSelectedChannel {
  readonly deviceId!: string;

  constructor(fields: Request_LgGetSelectedChannel) {
    Object.assign(this, fields);
  }
}
