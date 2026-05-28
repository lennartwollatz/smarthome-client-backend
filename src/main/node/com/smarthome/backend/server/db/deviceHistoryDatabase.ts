import Database from "better-sqlite3";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { logger } from "../../logger.js";
import { resolveDeviceHistoryDbPath } from "./deviceHistoryPaths.js";

type DatabaseInstance = InstanceType<typeof Database>;

/** Kategorien in der pro-Gerät-Verlaufs-Datenbank. */
export type DeviceHistoryCategory =
  | "sensor"
  | "bmw_telemetry"
  | "energy_archive"
  | "energy_live";

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS device_history (
    category TEXT NOT NULL PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`;

/**
 * Lazy SQLite-Verbindungen: eine Datei pro Gerät, geöffnet nur bei Bedarf.
 */
export class DeviceHistoryDatabase {
  private readonly baseDir: string;
  private readonly connections = new Map<string, DatabaseInstance>();

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    if (baseDir && baseDir !== "." && !existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }
  }

  readCategory<T>(deviceId: string, category: DeviceHistoryCategory): T | null {
    if (!deviceId) return null;
    return this.withConnection(deviceId, db => {
      const row = db
        .prepare("SELECT data FROM device_history WHERE category = ?")
        .get(category) as { data: string } | undefined;
      if (!row?.data) return null;
      try {
        return JSON.parse(row.data) as T;
      } catch (e) {
        logger.warn({ e, deviceId, category }, "DeviceHistory: JSON parse fehlgeschlagen");
        return null;
      }
    });
  }

  writeCategory<T>(deviceId: string, category: DeviceHistoryCategory, data: T): void {
    if (!deviceId) return;
    const json = JSON.stringify(data);
    this.withConnection(deviceId, db => {
      db.prepare(
        `
        INSERT INTO device_history (category, data, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(category) DO UPDATE SET
          data = excluded.data,
          updated_at = datetime('now')
      `
      ).run(category, json);
    });
  }

  deleteCategory(deviceId: string, category: DeviceHistoryCategory): void {
    if (!deviceId) return;
    this.withConnection(deviceId, db => {
      db.prepare("DELETE FROM device_history WHERE category = ?").run(category);
    });
  }

  deleteDeviceDatabase(deviceId: string): void {
    this.closeDevice(deviceId);
    const filePath = resolveDeviceHistoryDbPath(this.baseDir, deviceId);
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (e) {
      logger.debug({ e, deviceId }, "DeviceHistory: Datei löschen fehlgeschlagen");
    }
  }

  closeDevice(deviceId: string): void {
    const db = this.connections.get(deviceId);
    if (db) {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      this.connections.delete(deviceId);
    }
  }

  closeAll(): void {
    for (const deviceId of [...this.connections.keys()]) {
      this.closeDevice(deviceId);
    }
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  private withConnection<T>(deviceId: string, fn: (db: DatabaseInstance) => T): T {
    const db = this.openConnection(deviceId);
    return fn(db);
  }

  private openConnection(deviceId: string): DatabaseInstance {
    let db = this.connections.get(deviceId);
    if (db) return db;

    const filePath = resolveDeviceHistoryDbPath(this.baseDir, deviceId);
    const dir = this.baseDir;
    if (dir && dir !== "." && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    db = new Database(filePath);
    db.pragma("journal_mode = WAL");
    db.exec(SCHEMA_SQL);
    this.connections.set(deviceId, db);
    return db;
  }
}
