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

const port = Number(process.env.PORT ?? 4040);
const dbPath = process.env.DB_URL ?? "data/smarthomeNew.sqlite";

const databaseManager = new DatabaseManager(dbPath);
databaseManager.connect();
const eventManager = new EventManager();
const settingManager = new SettingManager(databaseManager);
const sceneManager = new SceneManager(databaseManager, eventManager);
const deviceManager = new DeviceManager(databaseManager, eventManager);
const floorplanManager = new FloorplanManager(databaseManager, deviceManager);
const userManager = new UserManager(databaseManager);
const actionManager = new ActionManager(databaseManager, eventManager, floorplanManager, settingManager, sceneManager, deviceManager, userManager);

const httpServer = createServer({
  databaseManager, eventManager, floorplanManager, settingManager, sceneManager, deviceManager, userManager, actionManager
});


httpServer.listen(port, () => {
  logger.info({ port }, "HTTP-Server vollständig gestartet.");
});
