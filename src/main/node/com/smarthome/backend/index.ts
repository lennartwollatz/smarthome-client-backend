import "dotenv/config";
import { createServer } from "./server/api/server.js";
import { DatabaseManager } from "./server/db/database.js";
import { logger } from "./logger.js";
import { EventManager } from "./server/events/EventManager.js";
import { ActionManager } from "./server/api/entities/actions/ActionManager.js";
import { ActionExecutionStore } from "./server/db/actionExecutionStore.js";
import { ActionExecutionService } from "./server/api/entities/actions/execution/actionExecutionService.js";
import { UserManager } from "./server/api/entities/users/userManager.js";
import { SettingManager } from "./server/api/entities/settings/settingManager.js";
import { FloorplanManager } from "./server/api/entities/floorplan/floorplanManager.js";
import { SceneManager } from "./server/api/entities/scenes/sceneManager.js";
import { DeviceManager } from "./server/api/entities/devices/deviceManager.js";
import { DataCollector } from "./server/ml/dataCollector.js";
import { VacuumCleaningHistoryStore } from "./server/db/vacuumCleaningHistoryStore.js";
import { EventLogStore } from "./server/db/eventLogStore.js";
import { DeviceChangeLogStore } from "./server/db/deviceChangeLogStore.js";

const port = Number(process.env.PORT ?? 4040);
const host = process.env.HOST ?? "127.0.0.1";
const dbPath = process.env.DB_URL ?? "data/smarthomeNew.sqlite";
const mlDbPath = process.env.ML_DB_URL ?? "data/ml.sqlite";
const vacuumCleaningHistoryDbPath =
  process.env.VACUUM_CLEANING_HISTORY_DB_URL ?? "data/vacuum-cleaning-history.sqlite";

const databaseManager = new DatabaseManager(dbPath);
databaseManager.connect();
const vacuumCleaningHistoryDb = new DatabaseManager(vacuumCleaningHistoryDbPath);
vacuumCleaningHistoryDb.connect();
const vacuumCleaningHistoryStore = new VacuumCleaningHistoryStore(vacuumCleaningHistoryDb);
const eventLogStore = new EventLogStore(databaseManager);
const deviceChangeLogStore = new DeviceChangeLogStore(databaseManager);
const eventManager = new EventManager(eventLogStore);
const settingManager = new SettingManager(databaseManager);
const sceneManager = new SceneManager(databaseManager, eventManager);
const deviceManager = new DeviceManager(
  databaseManager,
  eventManager,
  vacuumCleaningHistoryStore,
  deviceChangeLogStore
);
const floorplanManager = new FloorplanManager(databaseManager, deviceManager);
const userManager = new UserManager(databaseManager);
const actionExecutionStore = new ActionExecutionStore(databaseManager);
const actionExecutionService = new ActionExecutionService(actionExecutionStore);
const actionManager = new ActionManager(
  databaseManager,
  eventManager,
  floorplanManager,
  settingManager,
  sceneManager,
  deviceManager,
  userManager,
  actionExecutionService
);

const dataCollector = new DataCollector(mlDbPath, deviceManager, settingManager, userManager, sceneManager);
eventManager.addOnEventCallback((event) => dataCollector.onEvent(event));

const httpServer = createServer({
  databaseManager,
  eventManager,
  floorplanManager,
  settingManager,
  sceneManager,
  deviceManager,
  userManager,
  actionManager,
  dataCollector,
  eventLogStore,
  deviceChangeLogStore
});

httpServer.listen(port, host,() => {
  logger.info({ port }, "HTTP-Server vollständig gestartet.");
});
