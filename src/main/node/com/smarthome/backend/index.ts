import "dotenv/config";
import { createServer } from "./server.js";
import { DatabaseManager } from "./server/db/database.js";
import { EventStreamManager } from "./server/events/eventStreamManager.js";
import { ActionManager } from "./server/actions/actionManager.js";
import { logger } from "./logger.js";

const port = Number(process.env.PORT ?? 4040);
const dbPath = process.env.DB_URL ?? "data/smarthome.sqlite";

const databaseManager = new DatabaseManager(dbPath);
databaseManager.connect();

const eventStreamManager = new EventStreamManager();
const actionManager = new ActionManager(databaseManager);

const app = createServer({ databaseManager, eventStreamManager, actionManager });

app.listen(port, () => {
  logger.info({ port }, "HTTP-Server gestartet");
});

