/** POST /api/modules/lg/devices/:deviceId/setHomeChannelNumber */
export class Request_LgSetHomeChannelNumber {
  readonly deviceId!: string;
  readonly channelId?: string | null;
  readonly homeChannelNumber?: number | null;

  constructor(fields: Request_LgSetHomeChannelNumber) {
    Object.assign(this, fields);
  }
}
