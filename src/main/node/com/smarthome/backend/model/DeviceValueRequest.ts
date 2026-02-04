export class DeviceValueRequest {
  value?: number;

  constructor(init?: Partial<DeviceValueRequest>) {
    Object.assign(this, init);
  }
}
