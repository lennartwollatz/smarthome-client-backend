/** POST /api/modules/xiaomi/devices/:deviceId/navigateToRoom – `status` ist `"success"` oder eine Fehlermeldung. */
export class Response_XiaomiNavigateToRoom {
  constructor(readonly status: string) {}
}
