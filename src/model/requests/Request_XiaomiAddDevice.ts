/** POST /api/modules/xiaomi/devices/add */
export class Request_XiaomiAddDevice {
  readonly ipAddress!: string;
  readonly token!: string;

  constructor(fields: Request_XiaomiAddDevice) {
    Object.assign(this, fields);
  }
}
