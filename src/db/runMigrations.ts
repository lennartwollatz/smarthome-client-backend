import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { logger } from "../config/logger.js";
import type { MySqlConfig } from "./dbConfig.js";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

const SQL_CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
      version     VARCHAR(255)  NOT NULL,
      applied_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

      CONSTRAINT pk_schema_migrations PRIMARY KEY (version)
  )`;

const SQL_SELECT_APPLIED_VERSIONS = `
  SELECT m.version
  FROM schema_migrations AS m`;

const SQL_INSERT_APPLIED_VERSION = `
  INSERT INTO schema_migrations (version)
  VALUES (?)`;

type MigrationRow = RowDataPacket & { version: string };

/**
 * Wendet alle noch nicht ausgeführten SQL-Dateien aus `migrations/` in Dateinamen-Reihenfolge an.
 * MySQL führt DDL nicht transaktional aus: Schlägt eine Migration fehl, bleiben bereits
 * angelegte Tabellen bestehen. Die Dateien verwenden daher `CREATE TABLE IF NOT EXISTS`.
 */
export async function runMigrations(config: MySqlConfig): Promise<void> {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: "utf8mb4",
    multipleStatements: true
  });

  try {
    await connection.query(SQL_CREATE_MIGRATIONS_TABLE);
    const applied = await loadAppliedVersions(connection);
    const pending = (await listMigrationFiles()).filter(file => !applied.has(toVersion(file)));

    if (pending.length === 0) {
      logger.info("Datenbankschema ist aktuell");
      return;
    }

    for (const file of pending) {
      const version = toVersion(file);
      logger.info({ version }, "Wende Datenbank-Migration an");
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      try {
        await connection.query(sql);
        await connection.execute(SQL_INSERT_APPLIED_VERSION, [version]);
      } catch (error) {
        logger.error({ error, version }, "Migration fehlgeschlagen");
        throw error;
      }
      logger.info({ version }, "Migration erfolgreich angewendet");
    }
  } finally {
    await connection.end();
  }
}

async function loadAppliedVersions(connection: Connection): Promise<Set<string>> {
  const [rows] = await connection.query<MigrationRow[]>(SQL_SELECT_APPLIED_VERSIONS);
  return new Set(rows.map(row => row.version));
}

async function listMigrationFiles(): Promise<string[]> {
  const files = await readdir(migrationsDir);
  return files.filter(name => name.endsWith(".sql")).sort();
}

function toVersion(file: string): string {
  return file.replace(/\.sql$/, "");
}
