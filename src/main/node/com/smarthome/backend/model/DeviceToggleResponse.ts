export class DeviceToggleResponse {
  id?: string;
  isOn?: boolean;

  constructor(init?: Partial<DeviceToggleResponse>) {
    Object.assign(this, init);
  }
}
