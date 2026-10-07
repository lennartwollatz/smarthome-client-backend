/** POST /api/modules/denon/devices/:deviceId/playPrevious */
export class Request_DenonPlayPrevious {
  readonly deviceId!: string;

  constructor(fields: Request_DenonPlayPrevious) {
    Object.assign(this, fields);
  }
}
