import { Device } from "./devices/Device.js";
export class PairingResponse {
  success?: boolean;
  device?: Device;
  error?: string;

  constructor(init?: Partial<PairingResponse>) {
    Object.assign(this, init);
  }
}
