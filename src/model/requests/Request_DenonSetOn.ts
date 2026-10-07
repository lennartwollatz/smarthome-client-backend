/** POST /api/modules/denon/devices/:deviceId/setOn */
export class Request_DenonSetOn {
  readonly deviceId!: string;

  constructor(fields: Request_DenonSetOn) {
    Object.assign(this, fields);
  }
}
