/** POST|PUT /api/modules/hue/devices/:deviceId/setBrightness */
export class Request_HueSetBrightness {
  readonly deviceId!: string;
  readonly brightness?: number | null;

  constructor(fields: Request_HueSetBrightness) {
    Object.assign(this, fields);
  }
}
