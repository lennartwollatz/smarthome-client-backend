import type { HueBridgeDiscovered } from "../../modules/hue/hueBridgeDiscovered.js";

/** Hue-Bridge ohne Zugangsdaten, wie sie die Bridge-Endpunkte zurückgeben. */
export class Response_HueBridge {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly port: number;
  readonly modelId?: string;
  readonly devices: string[];
  readonly swVersion?: string;
  readonly isPaired: boolean;

  constructor(
    bridge: Pick<HueBridgeDiscovered, "id" | "name" | "address" | "port" | "modelId" | "devices" | "swVersion" | "isPaired">
  ) {
    this.id = bridge.id;
    this.name = bridge.name;
    this.address = bridge.address;
    this.port = bridge.port;
    this.modelId = bridge.modelId;
    this.devices = bridge.devices;
    this.swVersion = bridge.swVersion;
    this.isPaired = bridge.isPaired;
  }
}
