import type { Device } from "../../../../model/devices/Device.js";
import { serializeDeviceForApi } from "./deviceSerialize.js";

/**
 * Persistiert nur den aktuellen Gerätezustand — keine Verlaufs-Arrays.
 */
export function serializeDeviceForDatabase(device: Device): Record<string, unknown> {
  const raw = serializeDeviceForApi(device);
  delete raw.temperatureHistory;

  const buttons = raw.buttons;
  if (buttons && typeof buttons === "object") {
    for (const btn of Object.values(buttons as Record<string, unknown>)) {
      if (btn && typeof btn === "object") {
        delete (btn as Record<string, unknown>).energyUsages;
      }
    }
  }

  return raw;
}

/** Entfernt Verlaufsfelder aus einem aus der DB geladenen Plain-Object. */
export function stripHistoryFieldsFromLoadedDevice(device: Record<string, unknown>): void {
  delete device.temperatureHistory;

  const buttons = device.buttons;
  if (buttons && typeof buttons === "object") {
    for (const btn of Object.values(buttons as Record<string, unknown>)) {
      if (btn && typeof btn === "object") {
        delete (btn as Record<string, unknown>).energyUsages;
      }
    }
  }
}
