import { ModuleBridgeDiscovered } from "../moduleBridgeDiscovered.js";

export class HueBridgeDiscovered extends ModuleBridgeDiscovered {
  modelId?:string;
  swVersion?:string;
  username?:string;
  clientKey?:string;

  constructor(bridgeId: string, name: string, ipAddress: string, modelId: string, swVersion: string, port: number = 80) {
    super(bridgeId, name, ipAddress, port);
    this.modelId = modelId;
    this.swVersion = swVersion;
  }

  withoutSensitiveData(): HueBridgeDiscovered {
    const copy = new HueBridgeDiscovered(this.id, this.name, this.address, this.modelId ?? "", this.swVersion ?? "");
    copy.isPaired = this.isPaired;
    copy.devices = this.devices;
    return copy;
  }
}

