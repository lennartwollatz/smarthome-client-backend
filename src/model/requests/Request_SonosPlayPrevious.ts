/** POST /api/modules/sonos/devices/:deviceId/playPrevious */
export class Request_SonosPlayPrevious {
  readonly deviceId!: string;

  constructor(fields: Request_SonosPlayPrevious) {
    Object.assign(this, fields);
  }
}
