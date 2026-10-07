/** POST /api/modules/sonos/devices/:deviceId/setPlayState */
export class Request_SonosSetPlayState {
  readonly deviceId!: string;
  readonly state?: string | null;

  constructor(fields: Request_SonosSetPlayState) {
    Object.assign(this, fields);
  }
}
