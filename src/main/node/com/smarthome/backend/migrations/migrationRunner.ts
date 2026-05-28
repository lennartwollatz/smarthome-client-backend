import type { DatabaseManager } from "../server/db/database.js";
import { logger } from "../logger.js";

export type MigrationContext = {
  mainDb: DatabaseManager;
  deviceHistoryDir: string;
};

export type Migration = {
  id: string;
  up: (ctx: MigrationContext) => void | Promise<void>;
};

const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT NOT NULL PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now'))
  );
`;

export function ensureMigrationsTable(mainDb: DatabaseManager): void {
  mainDb.getConnection().exec(MIGRATIONS_TABLE);
}

export function isMigrationApplied(mainDb: DatabaseManager, id: string): boolean {
  ensureMigrationsTable(mainDb);
  const row = mainDb
    .getConnection()
    .prepare("SELECT id FROM schema_migrations WHERE id = ?")
    .get(id) as { id: string } | undefined;
  return !!row;
}

export function markMigrationApplied(mainDb: DatabaseManager, id: string): void {
  ensureMigrationsTable(mainDb);
  mainDb.getConnection().prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(id);
}

export async function runPendingMigrations(
  mainDb: DatabaseManager,
  migrations: Migration[],
  ctx: MigrationContext
): Promise<void> {
  ensureMigrationsTable(mainDb);
  for (const migration of migrations) {
    if (isMigrationApplied(mainDb, migration.id)) {
      logger.info({ id: migration.id }, "Migration bereits angewendet — übersprungen");
      continue;
    }
    logger.info({ id: migration.id }, "Wende Migration an …");
    await migration.up(ctx);
    markMigrationApplied(mainDb, migration.id);
    logger.info({ id: migration.id }, "Migration erfolgreich angewendet");
  }
}
