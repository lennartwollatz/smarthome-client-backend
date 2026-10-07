/** POST /api/modules/matter/devices/:deviceId/:buttonId/setOff */
export class Request_MatterSetOff {
  readonly deviceId!: string;
  readonly buttonId!: string;

  constructor(fields: Request_MatterSetOff) {
    Object.assign(this, fields);
  }
}
