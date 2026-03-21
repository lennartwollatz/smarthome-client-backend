import "dotenv/config";
import { createServer } from "./createServer.js";
import { DatabaseManager } from "./server/db/database.js";
import { logger } from "./logger.js";
import { EventManager } from "./server/events/EventManager.js";
import { ActionManager } from "./server/actions/ActionManager.js";
import { MatterPresenceDeviceManager } from "./server/presence/MatterPresenceDeviceManager.js";

const port = Number(process.env.PORT ?? 4040);
const dbPath = process.env.DB_URL ?? "data/smarthomeNew.sqlite";

const databaseManager = new DatabaseManager(dbPath);
databaseManager.connect();

const eventManager = new EventManager();
const actionManager = new ActionManager(databaseManager, eventManager);
const presenceManager = new MatterPresenceDeviceManager(actionManager, eventManager, databaseManager);

const httpServer = createServer({ databaseManager, eventManager, actionManager, presenceManager });

httpServer.listen(port, () => {
  logger.info({ port }, "HTTP-Server gestartet");

  presenceManager.initialize().catch(err => {
    logger.error({ err }, "Fehler beim Initialisieren der Presence-Devices");
  });
});

