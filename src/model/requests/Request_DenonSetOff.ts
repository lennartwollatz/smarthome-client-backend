/** POST /api/modules/denon/devices/:deviceId/setOff */
export class Request_DenonSetOff {
  readonly deviceId!: string;

  constructor(fields: Request_DenonSetOff) {
    Object.assign(this, fields);
  }
}
