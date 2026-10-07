/** POST /api/modules/sonos/devices/:deviceId/setOff */
export class Request_SonosSetOff {
  readonly deviceId!: string;

  constructor(fields: Request_SonosSetOff) {
    Object.assign(this, fields);
  }
}
