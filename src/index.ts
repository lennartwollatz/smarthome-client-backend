import "dotenv/config";
import { createServer } from "./server.js";
import { DatabaseManager } from "./db/database.js";
import { logger } from "./config/logger.js";
import { getAppConfig } from "./config/appConfig.js";
import { EventManager } from "./events/EventManager.js";
import { ActionManager } from "./actions/ActionManager.js";
import { MatterPresenceDeviceManager } from "./modules/presence/MatterPresenceDeviceManager.js";
import { MatterVoiceAssistantManager } from "./modules/voiceassistant/MatterVoiceAssistantManager.js";

const databaseManager = new DatabaseManager();

try {
  const { port } = getAppConfig();
  await databaseManager.connect();

  const eventManager = new EventManager();
  const actionManager = new ActionManager(databaseManager, eventManager);
  await actionManager.initialize();

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
} catch (error) {
  logger.error({ error }, "Backend konnte nicht gestartet werden");
  process.exit(1);
}
