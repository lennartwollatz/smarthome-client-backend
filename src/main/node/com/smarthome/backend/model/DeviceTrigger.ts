export class DeviceTrigger {
  triggerDeviceId?: string;
  triggerModuleId?: string;
  triggerEvent?: string;
  triggerValues?: Object[];

  constructor(init?: Partial<DeviceTrigger>) {
    Object.assign(this, init);
  }
}
