/** POST /api/modules/matter/devices/:deviceId/:buttonId/setIntensity */
export class Request_MatterSetIntensity {
  readonly deviceId!: string;
  readonly buttonId!: string;
  readonly intensity?: number | null;

  constructor(fields: Request_MatterSetIntensity) {
    Object.assign(this, fields);
  }
}
