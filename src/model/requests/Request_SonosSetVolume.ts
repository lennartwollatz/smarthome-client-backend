/** POST /api/modules/sonos/devices/:deviceId/setVolume */
export class Request_SonosSetVolume {
  readonly deviceId!: string;
  readonly volume?: number | null;

  constructor(fields: Request_SonosSetVolume) {
    Object.assign(this, fields);
  }
}
