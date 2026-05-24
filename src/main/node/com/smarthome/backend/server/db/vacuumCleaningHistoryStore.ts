import type { DatabaseManager } from "./database.js";
import { JsonRepository } from "./jsonRepository.js";
import { logger } from "../../logger.js";

/** Rohdaten älter als 365 Tage werden verworfen. */
const HISTORY_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES_PER_DEVICE = 500;

export type VacuumCleaningHistoryEntry = {
  /** Zeitpunkt des Reinigungsabschlusses (ms seit Epoch). */
  time: number;
  /** Gerätemodus beim Abschluss (z. B. docked, cleaning_stopped). */
  mode: string;
  /** Betroffene Staubsauger-Raum-IDs, falls Raumreinigung. */
  rooms: string[];
};

export type VacuumCleaningHistoryData = {
  entries: VacuumCleaningHistoryEntry[];
};

export function todayBounds(now: Date = new Date()): { fromMs: number; toMs: number } {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const fromMs = d.getTime();
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { fromMs, toMs: end.getTime() };
}

export class VacuumCleaningHistoryStore {
  private repo: JsonRepository<VacuumCleaningHistoryData>;

  constructor(db: DatabaseManager) {
    this.repo = new JsonRepository<VacuumCleaningHistoryData>(db, "VacuumCleaningHistory");
  }

  private empty(): VacuumCleaningHistoryData {
    return { entries: [] };
  }

  private load(deviceId: string): VacuumCleaningHistoryData {
    try {
      return this.repo.findById(deviceId) ?? this.empty();
    } catch (e) {
      logger.warn({ e, deviceId }, "VacuumCleaningHistory: findById fehlgeschlagen");
      return this.empty();
    }
  }

  private trim(entries: VacuumCleaningHistoryEntry[]): VacuumCleaningHistoryEntry[] {
    const minTime = Date.now() - HISTORY_MAX_AGE_MS;
    const filtered = entries.filter(e => Number.isFinite(e.time) && e.time >= minTime);
    if (filtered.length <= MAX_ENTRIES_PER_DEVICE) {
      return filtered;
    }
    return filtered.slice(-MAX_ENTRIES_PER_DEVICE);
  }

  recordCleaning(
    deviceId: string,
    entry: Omit<VacuumCleaningHistoryEntry, "time"> & { time?: number }
  ): void {
    if (!deviceId) return;
    const time = entry.time ?? Date.now();
    if (!Number.isFinite(time)) return;

    const row = this.load(deviceId);
    const last = row.entries[row.entries.length - 1];
    if (last && last.time === time && last.mode === entry.mode) {
      return;
    }

    row.entries.push({
      time,
      mode: entry.mode ?? "",
      rooms: Array.isArray(entry.rooms) ? [...entry.rooms] : [],
    });
    row.entries = this.trim(row.entries);

    try {
      this.repo.save(deviceId, row);
    } catch (e) {
      logger.error({ e, deviceId }, "VacuumCleaningHistory: save fehlgeschlagen");
    }
  }

  hasCleaningToday(deviceId: string, now: Date = new Date()): boolean {
    if (!deviceId) return false;
    const { fromMs, toMs } = todayBounds(now);
    return (this.load(deviceId).entries ?? []).some(e => e.time >= fromMs && e.time <= toMs);
  }

  getEntries(deviceId: string): VacuumCleaningHistoryEntry[] {
    return [...(this.load(deviceId).entries ?? [])].sort((a, b) => b.time - a.time);
  }

  deleteByDeviceId(deviceId: string): void {
    try {
      this.repo.deleteById(deviceId);
    } catch (e) {
      logger.debug({ e, deviceId }, "VacuumCleaningHistory: deleteByDeviceId");
    }
  }
}
