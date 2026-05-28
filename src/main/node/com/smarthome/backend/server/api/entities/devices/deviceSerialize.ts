import type { Device } from "../../../../model/devices/Device.js";
import { stripHistoryFieldsFromLoadedDevice } from "./serializeDeviceForDatabase.js";

/** API/DB-Payload ohne Verlaufs-Arrays (Verläufe nur über History-APIs). */
export function serializeDeviceForApi(device: Device): Record<string, unknown> {
  let raw: Record<string, unknown>;
  if (device && typeof (device as Device).toJSON === "function") {
    raw = (device as Device).toJSON();
  } else {
    raw = device as unknown as Record<string, unknown>;
  }
  stripHistoryFieldsFromLoadedDevice(raw);
  return raw;
}

export function serializeDevicesForApi(devices: Device[]): Record<string, unknown>[] {
  return devices.map(d => serializeDeviceForApi(d));
}
