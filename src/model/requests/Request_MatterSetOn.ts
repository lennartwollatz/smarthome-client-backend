/** POST /api/modules/matter/devices/:deviceId/:buttonId/setOn */
export class Request_MatterSetOn {
  readonly deviceId!: string;
  readonly buttonId!: string;

  constructor(fields: Request_MatterSetOn) {
    Object.assign(this, fields);
  }
}
