/** POST /api/modules/presence/devices/:deviceId/togglePresence */
export class Request_PresenceTogglePresence {
  readonly deviceId!: string;

  constructor(fields: Request_PresenceTogglePresence) {
    Object.assign(this, fields);
  }
}
