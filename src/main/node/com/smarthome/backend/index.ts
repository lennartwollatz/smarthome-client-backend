import "dotenv/config";
import { createServer } from "./server/api/server.js";
import { DatabaseManager } from "./server/db/database.js";
import { logger } from "./logger.js";
import { EventManager } from "./server/events/EventManager.js";
import { ActionManager } from "./server/api/entities/actions/ActionManager.js";
import { UserManager } from "./server/api/entities/users/userManager.js";
import { SettingManager } from "./server/api/entities/settings/settingManager.js";
import { FloorplanManager } from "./server/api/entities/floorplan/floorplanManager.js";
import { SceneManager } from "./server/api/entities/scenes/sceneManager.js";
import { DeviceManager } from "./server/api/entities/devices/deviceManager.js";
import { DataCollector } from "./server/ml/dataCollector.js";

const port = Number(process.env.PORT ?? 4040);
const dbPath = process.env.DB_URL ?? "data/smarthomeNew.sqlite";
const mlDbPath = process.env.ML_DB_URL ?? "data/ml.sqlite";

const databaseManager = new DatabaseManager(dbPath);
databaseManager.connect();
const eventManager = new EventManager();
const settingManager = new SettingManager(databaseManager);
const sceneManager = new SceneManager(databaseManager, eventManager);
const deviceManager = new DeviceManager(databaseManager, eventManager);
const floorplanManager = new FloorplanManager(databaseManager, deviceManager);
const userManager = new UserManager(databaseManager);
const actionManager = new ActionManager(databaseManager, eventManager, floorplanManager, settingManager, sceneManager, deviceManager, userManager);

const dataCollector = new DataCollector(mlDbPath, deviceManager, settingManager, userManager, sceneManager);
eventManager.addOnEventCallback((event) => dataCollector.onEvent(event));

const httpServer = createServer({
  databaseManager, eventManager, floorplanManager, settingManager, sceneManager, deviceManager, userManager, actionManager, dataCollector
});

httpServer.listen(port, () => {
  logger.info({ port }, "HTTP-Server vollständig gestartet.");
});
