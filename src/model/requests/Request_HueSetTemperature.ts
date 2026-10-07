/** POST|PUT /api/modules/hue/devices/:deviceId/setTemperature */
export class Request_HueSetTemperature {
  readonly deviceId!: string;
  readonly temperature?: number | null;

  constructor(fields: Request_HueSetTemperature) {
    Object.assign(this, fields);
  }
}
