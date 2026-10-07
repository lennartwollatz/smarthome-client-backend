/** GET /api/modules/xiaomi/devices/:deviceId/roomMapping */
export class Request_XiaomiGetRoomMapping {
  readonly deviceId!: string;

  constructor(fields: Request_XiaomiGetRoomMapping) {
    Object.assign(this, fields);
  }
}
