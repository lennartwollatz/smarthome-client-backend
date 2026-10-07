/** POST /api/modules/denon/devices/:deviceId/setZonePower */
export class Request_DenonSetZonePower {
  readonly deviceId!: string;
  readonly zoneName?: string | null;
  readonly power?: boolean | null;

  constructor(fields: Request_DenonSetZonePower) {
    Object.assign(this, fields);
  }
}
