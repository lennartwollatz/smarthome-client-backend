/** DELETE /api/devices/:deviceId */
export class Request_DeleteDevice {
  readonly deviceId!: string;

  constructor(fields: Request_DeleteDevice) {
    Object.assign(this, fields);
  }
}
