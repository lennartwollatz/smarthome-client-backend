/** POST /api/modules/lg/devices/:deviceId/setChannel */
export class Request_LgSetChannel {
  readonly deviceId!: string;
  readonly channelId?: string | null;

  constructor(fields: Request_LgSetChannel) {
    Object.assign(this, fields);
  }
}
