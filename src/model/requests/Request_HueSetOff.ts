/** POST|PUT /api/modules/hue/devices/:deviceId/setOff */
export class Request_HueSetOff {
  readonly deviceId!: string;

  constructor(fields: Request_HueSetOff) {
    Object.assign(this, fields);
  }
}
