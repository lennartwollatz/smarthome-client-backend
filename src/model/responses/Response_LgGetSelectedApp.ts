/** GET /api/modules/lg/devices/:deviceId/selectedApp */
export class Response_LgGetSelectedApp {
  constructor(readonly appId: string) {}
}
