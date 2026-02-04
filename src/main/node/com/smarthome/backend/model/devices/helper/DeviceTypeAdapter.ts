import { DeviceType, deviceTypeFromString } from "./DeviceType.js";

export class DeviceTypeAdapter {
  static serialize(type?: DeviceType | null) {
    return type ?? null;
  }

  static deserialize(value?: string | null) {
    return deviceTypeFromString(value);
  }
}

