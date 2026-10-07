/** POST /api/modules/denon/devices/:deviceId/setVolume */
export class Request_DenonSetVolume {
  readonly deviceId!: string;
  readonly volume?: number | null;

  constructor(fields: Request_DenonSetVolume) {
    Object.assign(this, fields);
  }
}
