/** POST /api/modules/sonos/devices/:deviceId/setOn */
export class Request_SonosSetOn {
  readonly deviceId!: string;

  constructor(fields: Request_SonosSetOn) {
    Object.assign(this, fields);
  }
}
