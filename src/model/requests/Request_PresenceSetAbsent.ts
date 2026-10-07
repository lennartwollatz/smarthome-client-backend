/** POST /api/modules/presence/devices/:deviceId/setAbsent */
export class Request_PresenceSetAbsent {
  readonly deviceId!: string;

  constructor(fields: Request_PresenceSetAbsent) {
    Object.assign(this, fields);
  }
}
