/** POST /api/modules/lg/devices/:deviceId/setHomeAppNumber */
export class Request_LgSetHomeAppNumber {
  readonly deviceId!: string;
  readonly appId?: string | null;
  readonly homeAppNumber?: number | null;

  constructor(fields: Request_LgSetHomeAppNumber) {
    Object.assign(this, fields);
  }
}
