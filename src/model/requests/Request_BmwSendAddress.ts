/** POST /api/modules/bmw/devices/:deviceId/sendAddress */
export class Request_BmwSendAddress {
  readonly deviceId!: string;
  readonly subject?: string | null;
  readonly name!: string;
  readonly latitude!: number;
  readonly longitude!: number;

  constructor(fields: Request_BmwSendAddress) {
    Object.assign(this, fields);
  }
}
