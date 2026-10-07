/** POST /api/modules/matter/devices/:deviceId/:buttonId/toggle */
export class Request_MatterToggle {
  readonly deviceId!: string;
  readonly buttonId!: string;

  constructor(fields: Request_MatterToggle) {
    Object.assign(this, fields);
  }
}
