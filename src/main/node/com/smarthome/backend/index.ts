import "dotenv/config";
import { createServer } from "./createServer.js";
import { DatabaseManager } from "./server/db/database.js";
import { logger } from "./logger.js";
import { EventManager } from "./server/events/EventManager.js";
import { ActionManager } from "./server/actions/ActionManager.js";
import { MatterPresenceDeviceManager } from "./server/api/modules/presence/MatterPresenceDeviceManager.js";
import { MatterVoiceAssistantManager } from "./server/api/modules/voiceassistant/MatterVoiceAssistantManager.js";

const port = Number(process.env.PORT ?? 4040);
const dbPath = process.env.DB_URL ?? "data/smarthomeNew.sqlite";

const databaseManager = new DatabaseManager(dbPath);
databaseManager.connect();

const eventManager = new EventManager();
const actionManager = new ActionManager(databaseManager, eventManager);
const presenceManager = new MatterPresenceDeviceManager(actionManager, eventManager, databaseManager);
const voiceAssistantManager = new MatterVoiceAssistantManager(actionManager, eventManager);

const httpServer = createServer({ databaseManager, eventManager, actionManager, presenceManager, voiceAssistantManager });

httpServer.listen(port, () => {
  logger.info({ port }, "HTTP-Server gestartet");

  presenceManager.initialize().catch(err => {
    logger.error({ err }, "Fehler beim Initialisieren der Presence-Devices");
  });

  voiceAssistantManager.initialize().catch(err => {
    logger.error({ err }, "Fehler beim Initialisieren der Voice-Assistant-Devices");
  });
});

