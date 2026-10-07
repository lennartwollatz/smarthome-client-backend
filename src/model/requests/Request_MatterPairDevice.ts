/** POST /api/modules/matter/devices/:deviceId/pair */
export class Request_MatterPairDevice {
  readonly deviceId!: string;
  readonly pairingCode!: string;

  constructor(fields: Request_MatterPairDevice) {
    Object.assign(this, fields);
  }
}
