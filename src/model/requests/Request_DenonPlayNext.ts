/** POST /api/modules/denon/devices/:deviceId/playNext */
export class Request_DenonPlayNext {
  readonly deviceId!: string;

  constructor(fields: Request_DenonPlayNext) {
    Object.assign(this, fields);
  }
}
