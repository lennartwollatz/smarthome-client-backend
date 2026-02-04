import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { logger } from "../../logger.js";

export class DatabaseManager {
  private dbPath: string;
  private db: Database | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  connect() {
    if (this.db) {
      logger.debug("Datenbankverbindung bereits geöffnet");
      return;
    }

    logger.info({ dbPath: this.dbPath }, "Verbinde mit Datenbank");
    this.ensureDbDirectory();
    this.db = new Database(this.dbPath);
    logger.info("Datenbankverbindung erfolgreich hergestellt");

    this.initializeSchema();
  }

  private initializeSchema() {
    logger.info("Initialisiere Datenbank-Schema...");
    this.db?.exec(`
      CREATE TABLE IF NOT EXISTS objects (
        id TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (id, type)
      );
      CREATE INDEX IF NOT EXISTS idx_objects_type ON objects(type);
      CREATE INDEX IF NOT EXISTS idx_objects_created_at ON objects(created_at DESC);
    `);
    logger.info("Datenbank-Schema erfolgreich initialisiert");
  }

  getConnection() {
    if (!this.db) {
      this.connect();
    }
    return this.db as Database;
  }

  createNewConnection() {
    if (!this.db) {
      this.connect();
    }
    this.ensureDbDirectory();
    const newDb = new Database(this.dbPath);
    logger.debug("Neue Datenbankverbindung erstellt");
    return newDb;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info("Datenbankverbindung geschlossen");
    }
  }

  isConnected() {
    try {
      return Boolean(this.db) && this.db?.open === true;
    } catch {
      return false;
    }
  }

  getAllTypes(): string[] {
    const rows = this.getConnection()
      .prepare("SELECT DISTINCT type FROM objects ORDER BY type")
      .all() as { type: string }[];
    logger.debug({ count: rows.length }, "Verschiedene Objekttypen gefunden");
    return rows.map(r => r.type);
  }

  countAllObjects(): number {
    const row = this.getConnection()
      .prepare("SELECT COUNT(*) AS count FROM objects")
      .get() as { count: number };
    logger.debug({ count: row?.count ?? 0 }, "Gesamtanzahl Objekte");
    return row?.count ?? 0;
  }

  countObjectsByType(type: string): number {
    const row = this.getConnection()
      .prepare("SELECT COUNT(*) AS count FROM objects WHERE type = ?")
      .get(type) as { count: number };
    logger.debug({ type, count: row?.count ?? 0 }, "Anzahl Objekte vom Typ");
    return row?.count ?? 0;
  }

  deleteAllByType(type: string): number {
    const result = this.getConnection()
      .prepare("DELETE FROM objects WHERE type = ?")
      .run(type);
    logger.info({ type, deleted: result.changes }, "Objekte vom Typ geloescht");
    return result.changes ?? 0;
  }

  deleteAllObjects(): number {
    const result = this.getConnection().prepare("DELETE FROM objects").run();
    logger.warn({ deleted: result.changes }, "Alle Objekte aus der Datenbank geloescht");
    return result.changes ?? 0;
  }

  private ensureDbDirectory() {
    const dir = path.dirname(this.dbPath);
    if (dir && dir !== "." && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      logger.info({ dir }, "Datenbank-Verzeichnis erstellt");
    }
  }
}

