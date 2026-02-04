export class DeviceValueResponse {
  id?: string;
  value?: number;

  constructor(init?: Partial<DeviceValueResponse>) {
    Object.assign(this, init);
  }
}
