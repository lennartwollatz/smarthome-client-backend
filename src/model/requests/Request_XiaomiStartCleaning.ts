/** POST /api/modules/xiaomi/devices/:deviceId/startCleaning */
export class Request_XiaomiStartCleaning {
  readonly deviceId!: string;

  constructor(fields: Request_XiaomiStartCleaning) {
    Object.assign(this, fields);
  }
}
