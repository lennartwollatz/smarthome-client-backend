/** POST /api/modules/denon/devices/:deviceId/setVolumeMax */
export class Request_DenonSetVolumeMax {
  readonly deviceId!: string;
  readonly volumeMax?: number | null;

  constructor(fields: Request_DenonSetVolumeMax) {
    Object.assign(this, fields);
  }
}
