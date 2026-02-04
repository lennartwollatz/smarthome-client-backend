export class DevicePolymorphicAdapter {
  constructor(_heosController?: unknown, _hueDeviceController?: unknown) {}

  serialize<T>(device: T) {
    return device;
  }

  deserialize<T>(data: T) {
    return data;
  }
}

