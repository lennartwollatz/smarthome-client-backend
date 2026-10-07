/** POST /api/modules/sonos/devices/:deviceId/playNext */
export class Request_SonosPlayNext {
  readonly deviceId!: string;

  constructor(fields: Request_SonosPlayNext) {
    Object.assign(this, fields);
  }
}
