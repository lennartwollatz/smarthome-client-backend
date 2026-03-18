import "dotenv/config";
import { createServer } from "./createServer.js";
import { DatabaseManager } from "./server/db/database.js";
import { logger } from "./logger.js";
import { EventManager } from "./server/events/EventManager.js";
import { ActionManager } from "./server/actions/ActionManager.js";

const port = Number(process.env.PORT ?? 4040);
const dbPath = process.env.DB_URL ?? "data/smarthomeNew.sqlite";

const databaseManager = new DatabaseManager(dbPath);
databaseManager.connect();

const eventManager = new EventManager();
const actionManager = new ActionManager(databaseManager, eventManager);

const app = createServer({ databaseManager, eventManager, actionManager });

app.listen(port, () => {
  logger.info({ port }, "HTTP-Server gestartet");
});

