import "dotenv/config";
import { DatabaseManager } from "./database.js";
import { logger } from "../config/logger.js";

const databaseManager = new DatabaseManager();

try {
  await databaseManager.connect();
  logger.info("Migrationen abgeschlossen");
} catch (error) {
  logger.error({ error }, "Migration fehlgeschlagen");
  process.exitCode = 1;
} finally {
  await databaseManager.close();
}
