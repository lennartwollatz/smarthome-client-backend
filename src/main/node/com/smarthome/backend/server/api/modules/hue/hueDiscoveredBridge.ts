export class HueDiscoveredBridge {
  bridgeId: string;
  name: string;
  ipAddress: string;
  port = 80;
  modelId: string;
  swVersion: string;
  isPaired?: boolean;
  username?: string;
  clientKey?: string;
  devices?: string[];

  constructor(bridgeId: string, name: string, ipAddress: string, modelId: string, swVersion: string) {
    this.bridgeId = bridgeId;
    this.name = name;
    this.ipAddress = ipAddress;
    this.modelId = modelId;
    this.swVersion = swVersion;
  }

  getApiUrl() {
    return `http://${this.ipAddress}:${this.port}/api`;
  }

  withoutSensitiveData() {
    const copy = new HueDiscoveredBridge(this.bridgeId, this.name, this.ipAddress, this.modelId, this.swVersion);
    copy.isPaired = this.isPaired;
    return copy;
  }
}

