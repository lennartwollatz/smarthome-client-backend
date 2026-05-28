import "dotenv/config";
import path from "node:path";
import { DatabaseManager } from "../server/db/database.js";
import { logger } from "../logger.js";
import { runPendingMigrations } from "./migrationRunner.js";
import { migration001SplitDeviceHistory } from "./001_split_device_history.js";

const dbPath = process.env.DB_URL ?? "data/smarthomeNew.sqlite";
const deviceHistoryDir =
  process.env.DEVICE_HISTORY_DIR ?? path.join(path.dirname(dbPath), "device-history");

const mainDb = new DatabaseManager(dbPath);
mainDb.connect();

runPendingMigrations(mainDb, [migration001SplitDeviceHistory], {
  mainDb,
  deviceHistoryDir
})
  .then(() => {
    mainDb.close();
    logger.info("Datenbank-Migrationen abgeschlossen");
    process.exit(0);
  })
  .catch(err => {
    logger.error({ err }, "Datenbank-Migration fehlgeschlagen");
    mainDb.close();
    process.exit(1);
  });
