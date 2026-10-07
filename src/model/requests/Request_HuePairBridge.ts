/** POST /api/modules/hue/bridges/:bridgeId/pair */
export class Request_HuePairBridge {
  readonly bridgeId!: string;

  constructor(fields: Request_HuePairBridge) {
    Object.assign(this, fields);
  }
}
