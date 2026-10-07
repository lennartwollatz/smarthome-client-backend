/** POST /api/modules/lg/devices/:deviceId/setVolume */
export class Request_LgSetVolume {
  readonly deviceId!: string;
  readonly volume?: number | null;

  constructor(fields: Request_LgSetVolume) {
    Object.assign(this, fields);
  }
}
