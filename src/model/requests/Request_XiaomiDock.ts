/** POST /api/modules/xiaomi/devices/:deviceId/dock */
export class Request_XiaomiDock {
  readonly deviceId!: string;

  constructor(fields: Request_XiaomiDock) {
    Object.assign(this, fields);
  }
}
