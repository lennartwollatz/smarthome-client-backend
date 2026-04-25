import type { DatabaseManager } from "./database.js";
import { JsonRepository } from "./jsonRepository.js";
import type { EnergyUsage } from "../../model/devices/energyTypes.js";
import { logger } from "../../logger.js";

/**
 * Aus dem Live-Array (7-Tage-Fenster im Gerät) herausfallende Messpunkte.
 * Maximalalter begrenzen, damit die JSON-Zeile nicht unbegrenzt wächst.
 */
const ARCHIVE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;

export type DeviceEnergyArchiveData = {
  /** buttonId -> Historie ausschließlich älter als das 7-Tage-Fenster im Gerät */
  buttons: Record<string, EnergyUsage[]>;
};

export class EnergyHistoryArchiveStore {
  private repo: JsonRepository<DeviceEnergyArchiveData>;

  constructor(db: DatabaseManager) {
    this.repo = new JsonRepository<DeviceEnergyArchiveData>(db, "DeviceEnergyArchive");
  }

  appendPruned(deviceId: string, buttonId: string, dropped: EnergyUsage[]): void {
    if (dropped.length === 0) return;
    const now = Date.now();
    const minTime = now - ARCHIVE_MAX_AGE_MS;
    const normalized = dropped
      .filter(u => u && typeof u.time === "number" && Number.isFinite(u.value))
      .map(u => ({ time: u.time, value: u.value }));
    if (normalized.length === 0) return;

    let row: DeviceEnergyArchiveData;
    try {
      row = this.repo.findById(deviceId) ?? { buttons: {} };
    } catch (e) {
      logger.warn({ e, deviceId }, "EnergyHistoryArchive: findById fehlgeschlagen");
      return;
    }

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
    try {
      this.repo.save(deviceId, row);
    } catch (e) {
      logger.error({ e, deviceId, buttonId }, "EnergyHistoryArchive: save fehlgeschlagen");
    }
  }

  getForButtonInRange(deviceId: string, buttonId: string, fromMs: number, toMs: number): EnergyUsage[] {
    try {
      const row = this.repo.findById(deviceId);
      if (!row) return [];
      return (row.buttons[buttonId] ?? []).filter(u => u.time >= fromMs && u.time <= toMs);
    } catch (e) {
      logger.debug({ e, deviceId }, "EnergyHistoryArchive: getForButtonInRange");
      return [];
    }
  }

  deleteByDeviceId(deviceId: string): void {
    try {
      this.repo.deleteById(deviceId);
    } catch (e) {
      logger.debug({ e, deviceId }, "EnergyHistoryArchive: deleteByDeviceId");
    }
  }
}
