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
  private db: DatabaseManager;
  private repo: JsonRepository<DeviceEnergyArchiveData>;

  constructor(db: DatabaseManager) {
    this.db = db;
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
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const effectiveFrom = Math.max(fromMs, Date.now() - sevenDaysMs);
    if (effectiveFrom > toMs) return [];

    const sql = `
      SELECT je.value AS value
      FROM objects o
      JOIN json_each(json_extract(o.data, '$.buttons')) AS btn
      JOIN json_each(btn.value) AS je
      WHERE o.id = ?
        AND o.type = 'DeviceEnergyArchive'
        AND btn.key = ?
        AND CAST(json_extract(je.value, '$.time') AS INTEGER) >= ?
        AND CAST(json_extract(je.value, '$.time') AS INTEGER) <= ?
      ORDER BY CAST(json_extract(je.value, '$.time') AS INTEGER) ASC
    `;

    const conn = this.db.createNewConnection();
    try {
      const rows = conn.prepare(sql).all(deviceId, buttonId, effectiveFrom, toMs) as { value: string }[];
      return rows
        .map(row => JSON.parse(row.value) as EnergyUsage)
        .filter(u => typeof u.time === "number" && Number.isFinite(u.value));
    } catch (e) {
      logger.debug({ e, deviceId }, "EnergyHistoryArchive: getForButtonInRange");
      return [];
    } finally {
      conn.close();
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
