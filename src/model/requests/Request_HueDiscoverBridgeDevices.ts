/** GET /api/modules/hue/discover/devices/:bridgeId */
export class Request_HueDiscoverBridgeDevices {
  readonly bridgeId!: string;

  constructor(fields: Request_HueDiscoverBridgeDevices) {
    Object.assign(this, fields);
  }
}
