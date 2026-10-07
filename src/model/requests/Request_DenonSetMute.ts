/** POST /api/modules/denon/devices/:deviceId/setMute */
export class Request_DenonSetMute {
  readonly deviceId!: string;
  readonly mute?: boolean | null;

  constructor(fields: Request_DenonSetMute) {
    Object.assign(this, fields);
  }
}
