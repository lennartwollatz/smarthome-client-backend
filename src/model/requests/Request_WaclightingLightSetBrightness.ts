/** POST /api/modules/waclighting/devices/:deviceId/light/setBrightness */
export class Request_WaclightingLightSetBrightness {
  readonly deviceId!: string;
  readonly brightness?: number | null;

  constructor(fields: Request_WaclightingLightSetBrightness) {
    Object.assign(this, fields);
  }
}
