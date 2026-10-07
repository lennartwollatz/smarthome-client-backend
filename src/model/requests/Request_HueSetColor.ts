/** POST|PUT /api/modules/hue/devices/:deviceId/setColor – CIE-xy-Koordinaten. */
export class Request_HueSetColor {
  readonly deviceId!: string;
  readonly x?: number | null;
  readonly y?: number | null;

  constructor(fields: Request_HueSetColor) {
    Object.assign(this, fields);
  }
}
