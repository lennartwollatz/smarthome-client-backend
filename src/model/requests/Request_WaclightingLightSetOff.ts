/** POST /api/modules/waclighting/devices/:deviceId/light/setOff */
export class Request_WaclightingLightSetOff {
  readonly deviceId!: string;

  constructor(fields: Request_WaclightingLightSetOff) {
    Object.assign(this, fields);
  }
}
