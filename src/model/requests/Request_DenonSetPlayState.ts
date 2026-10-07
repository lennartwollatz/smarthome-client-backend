/** POST /api/modules/denon/devices/:deviceId/setPlayState */
export class Request_DenonSetPlayState {
  readonly deviceId!: string;
  readonly state?: string | null;

  constructor(fields: Request_DenonSetPlayState) {
    Object.assign(this, fields);
  }
}
