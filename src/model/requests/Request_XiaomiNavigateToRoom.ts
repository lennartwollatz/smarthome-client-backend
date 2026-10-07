/** POST /api/modules/xiaomi/devices/:deviceId/navigateToRoom */
export class Request_XiaomiNavigateToRoom {
  readonly deviceId!: string;
  readonly roomId!: number;

  constructor(fields: Request_XiaomiNavigateToRoom) {
    Object.assign(this, fields);
  }
}
