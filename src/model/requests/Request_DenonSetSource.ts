/** POST /api/modules/denon/devices/:deviceId/setSource */
export class Request_DenonSetSource {
  readonly deviceId!: string;
  readonly sourceIndex?: string | null;
  readonly selected?: boolean | null;

  constructor(fields: Request_DenonSetSource) {
    Object.assign(this, fields);
  }
}
