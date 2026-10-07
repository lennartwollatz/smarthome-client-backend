/** POST /api/modules/matter/devices/pair-by-code */
export class Request_MatterPairDeviceByCode {
  readonly pairingCode!: string;

  constructor(fields: Request_MatterPairDeviceByCode) {
    Object.assign(this, fields);
  }
}
