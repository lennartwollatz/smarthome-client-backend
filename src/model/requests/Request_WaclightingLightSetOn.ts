/** POST /api/modules/waclighting/devices/:deviceId/light/setOn */
export class Request_WaclightingLightSetOn {
  readonly deviceId!: string;

  constructor(fields: Request_WaclightingLightSetOn) {
    Object.assign(this, fields);
  }
}
