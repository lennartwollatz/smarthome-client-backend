/** POST /api/modules/sonos/devices/:deviceId/setMute */
export class Request_SonosSetMute {
  readonly deviceId!: string;
  readonly mute?: boolean | null;

  constructor(fields: Request_SonosSetMute) {
    Object.assign(this, fields);
  }
}
