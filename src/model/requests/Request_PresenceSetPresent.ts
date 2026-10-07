/** POST /api/modules/presence/devices/:deviceId/setPresent */
export class Request_PresenceSetPresent {
  readonly deviceId!: string;

  constructor(fields: Request_PresenceSetPresent) {
    Object.assign(this, fields);
  }
}
