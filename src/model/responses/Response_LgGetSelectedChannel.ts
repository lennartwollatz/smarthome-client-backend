/** GET /api/modules/lg/devices/:deviceId/selectedChannel */
export class Response_LgGetSelectedChannel {
  constructor(readonly channelId: string) {}
}
