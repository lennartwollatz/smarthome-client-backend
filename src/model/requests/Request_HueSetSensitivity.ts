/** POST|PUT /api/modules/hue/devices/:deviceId/setSensitivity */
export class Request_HueSetSensitivity {
  readonly deviceId!: string;
  readonly sensitivity?: number | null;

  constructor(fields: Request_HueSetSensitivity) {
    Object.assign(this, fields);
  }
}
