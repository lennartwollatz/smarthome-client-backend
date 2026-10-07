/** POST|PUT /api/modules/hue/devices/:deviceId/setOn */
export class Request_HueSetOn {
  readonly deviceId!: string;

  constructor(fields: Request_HueSetOn) {
    Object.assign(this, fields);
  }
}
