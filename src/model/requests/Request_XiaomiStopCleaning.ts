/** POST /api/modules/xiaomi/devices/:deviceId/stopCleaning */
export class Request_XiaomiStopCleaning {
  readonly deviceId!: string;

  constructor(fields: Request_XiaomiStopCleaning) {
    Object.assign(this, fields);
  }
}
