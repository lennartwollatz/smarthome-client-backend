/** POST /api/modules/denon/devices/:deviceId/setVolumeStart */
export class Request_DenonSetVolumeStart {
  readonly deviceId!: string;
  readonly volumeStart?: number | null;

  constructor(fields: Request_DenonSetVolumeStart) {
    Object.assign(this, fields);
  }
}
