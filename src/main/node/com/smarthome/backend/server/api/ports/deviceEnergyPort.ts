import type { EnergyUsage } from "../../../model/devices/energyTypes.js";

export type DeviceEnergyPort = {
  appendPrunedToArchive(deviceId: string, buttonId: string, dropped: EnergyUsage[]): void;
  requestPersistAfterEnergyUpdate(deviceId: string): void;
};

let port: DeviceEnergyPort | null = null;

const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
const PERSIST_DEBOUNCE_MS = 2000;

export function setDeviceEnergyPort(p: DeviceEnergyPort | null): void {
  port = p;
}

export function appendPrunedEnergyToArchive(deviceId: string, buttonId: string, dropped: EnergyUsage[]): void {
  if (dropped.length === 0) return;
  try {
    port?.appendPrunedToArchive(deviceId, buttonId, dropped);
  } catch {
    // nicht blockierend
  }
}

export function requestPersistAfterEnergyUpdate(deviceId: string): void {
  if (!port) return;
  const t = persistTimers.get(deviceId);
  if (t) clearTimeout(t);
  persistTimers.set(
    deviceId,
    setTimeout(() => {
      persistTimers.delete(deviceId);
      try {
        port?.requestPersistAfterEnergyUpdate(deviceId);
      } catch {
        // nicht blockierend
      }
    }, PERSIST_DEBOUNCE_MS)
  );
}
