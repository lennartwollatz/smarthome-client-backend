import type { EnergyUsage } from "../../model/devices/energyTypes.js";
import type { DeviceHistoryDatabase } from "./deviceHistoryDatabase.js";
import { logger } from "../../logger.js";

/**
 * Langzeit-Archiv für Energie-Messpunkte, die aus dem 48-Stunden-Live-Fenster fallen.
 * Maximalalter begrenzen, damit die JSON-Zeile nicht unbegrenzt wächst.
 */
const ARCHIVE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;

export type DeviceEnergyArchiveData = {
  /** buttonId -> Historie außerhalb des 48-Stunden-Live-Fensters im Gerät */
  buttons: Record<string, EnergyUsage[]>;
};

export type DeviceEnergyLiveData = {
  buttons: Record<string, EnergyUsage[]>;
};

export class EnergyHistoryArchiveStore {
  constructor(private readonly deviceHistoryDb: DeviceHistoryDatabase) {}

  private loadArchive(deviceId: string): DeviceEnergyArchiveData {
    try {
      return this.deviceHistoryDb.readCategory<DeviceEnergyArchiveData>(deviceId, "energy_archive") ?? { buttons: {} };
    } catch (e) {
      logger.warn({ e, deviceId }, "EnergyHistoryArchive: load archive fehlgeschlagen");
      return { buttons: {} };
    }
  }

  private saveArchive(deviceId: string, row: DeviceEnergyArchiveData): void {
    try {
      this.deviceHistoryDb.writeCategory(deviceId, "energy_archive", row);
    } catch (e) {
      logger.error({ e, deviceId }, "EnergyHistoryArchive: save archive fehlgeschlagen");
    }
  }

  private loadLive(deviceId: string): DeviceEnergyLiveData {
    try {
      return this.deviceHistoryDb.readCategory<DeviceEnergyLiveData>(deviceId, "energy_live") ?? { buttons: {} };
    } catch (e) {
      logger.warn({ e, deviceId }, "EnergyHistoryArchive: load live fehlgeschlagen");
      return { buttons: {} };
    }
  }

  private saveLive(deviceId: string, row: DeviceEnergyLiveData): void {
    try {
      this.deviceHistoryDb.writeCategory(deviceId, "energy_live", row);
    } catch (e) {
      logger.error({ e, deviceId }, "EnergyHistoryArchive: save live fehlgeschlagen");
    }
  }

  appendPruned(deviceId: string, buttonId: string, dropped: EnergyUsage[]): void {
    if (dropped.length === 0) return;
    const now = Date.now();
    const minTime = now - ARCHIVE_MAX_AGE_MS;
    const normalized = dropped
      .filter(u => u && typeof u.time === "number" && Number.isFinite(u.value))
      .map(u => ({ time: u.time, value: u.value }));
    if (normalized.length === 0) return;

    const row = this.loadArchive(deviceId);
    const byTime = new Map<number, EnergyUsage>();
    for (const u of row.buttons[buttonId] ?? []) {
      if (u.time >= minTime) {
        byTime.set(u.time, { time: u.time, value: u.value });
      }
    }
    for (const u of normalized) {
      if (u.time >= minTime) {
        byTime.set(u.time, u);
      }
    }
    const merged = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
    row.buttons[buttonId] = merged;
    this.saveArchive(deviceId, row);
  }

  replaceLiveWindow(deviceId: string, buttonId: string, usages: EnergyUsage[]): void {
    const row = this.loadLive(deviceId);
    row.buttons[buttonId] = usages
      .filter(u => u && typeof u.time === "number" && Number.isFinite(u.value))
      .map(u => ({ time: u.time, value: u.value }));
    this.saveLive(deviceId, row);
  }

  getLiveForButtonInRange(
    deviceId: string,
    buttonId: string,
    fromMs: number,
    toMs: number
  ): EnergyUsage[] {
    const row = this.loadLive(deviceId);
    return (row.buttons[buttonId] ?? [])
      .filter(u => u.time >= fromMs && u.time <= toMs)
      .sort((a, b) => a.time - b.time);
  }

  getForButtonInRange(deviceId: string, buttonId: string, fromMs: number, toMs: number): EnergyUsage[] {
    const effectiveFrom = Math.max(fromMs, Date.now() - ARCHIVE_MAX_AGE_MS);
    if (effectiveFrom > toMs) return [];

    const row = this.loadArchive(deviceId);
    return (row.buttons[buttonId] ?? [])
      .filter(u => u.time >= effectiveFrom && u.time <= toMs)
      .sort((a, b) => a.time - b.time);
  }

  deleteByDeviceId(deviceId: string): void {
    try {
      this.deviceHistoryDb.deleteCategory(deviceId, "energy_archive");
      this.deviceHistoryDb.deleteCategory(deviceId, "energy_live");
      this.deviceHistoryDb.closeDevice(deviceId);
    } catch (e) {
      logger.debug({ e, deviceId }, "EnergyHistoryArchive: deleteByDeviceId");
    }
  }

  importLegacyArchive(deviceId: string, data: DeviceEnergyArchiveData): void {
    this.saveArchive(deviceId, data);
  }

  importLegacyLiveFromDevice(deviceId: string, buttons: Record<string, EnergyUsage[]>): void {
    if (!buttons || Object.keys(buttons).length === 0) return;
    this.saveLive(deviceId, { buttons });
  }
}
