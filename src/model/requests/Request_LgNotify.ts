/** POST /api/modules/lg/devices/:deviceId/notify */
export class Request_LgNotify {
  readonly deviceId!: string;
  readonly message?: string | null;

  constructor(fields: Request_LgNotify) {
    Object.assign(this, fields);
  }
}
