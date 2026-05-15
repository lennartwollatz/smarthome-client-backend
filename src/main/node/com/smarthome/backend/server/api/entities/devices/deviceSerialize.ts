import type { Device } from "../../../../model/devices/Device.js";

/** API/DB-Payload: Klassen-Instanzen mit toJSON, sonst Plain-Object. */
export function serializeDeviceForApi(device: Device): Record<string, unknown> {
  if (device && typeof (device as Device).toJSON === "function") {
    return (device as Device).toJSON();
  }
  return device as unknown as Record<string, unknown>;
}

export function serializeDevicesForApi(devices: Device[]): Record<string, unknown>[] {
  return devices.map(d => serializeDeviceForApi(d));
}
