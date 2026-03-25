import express, { type RequestHandler } from "express";
import { createServer as createHttpServer } from "http";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./logger.js";
import { createApiRouter } from "./server/api/router.js";
import { LiveUpdateService } from "./server/live/LiveUpdateService.js";
import type { DatabaseManager } from "./server/db/database.js";
import type { EventManager } from "./server/events/EventManager.js";
import type { ActionManager } from "./server/actions/ActionManager.js";
import type { MatterPresenceDeviceManager } from "./server/api/modules/presence/MatterPresenceDeviceManager.js";
import type { MatterVoiceAssistantManager } from "./server/api/modules/voiceassistant/MatterVoiceAssistantManager.js";

type ServerDeps = {
  databaseManager: DatabaseManager;
  eventManager: EventManager;
  actionManager: ActionManager;
  presenceManager: MatterPresenceDeviceManager;
  voiceAssistantManager: MatterVoiceAssistantManager;
};

export function createServer(deps: ServerDeps) {
  const app = express();
  const httpServer = createHttpServer(app);
  const liveUpdateService = new LiveUpdateService(httpServer);

  deps.actionManager.setLiveUpdateService(liveUpdateService);
  deps.presenceManager.setLiveUpdateService(liveUpdateService);
  deps.voiceAssistantManager.setLiveUpdateService(liveUpdateService);

  const httpLogger = (pinoHttp as unknown as (opts: { logger: typeof logger }) => RequestHandler)({
    logger
  });
  app.use(httpLogger);
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  app.use("/api", createApiRouter(deps));

  app.use((req, res) => {
    res.status(404).json({ error: `Endpoint not found: ${req.path}` });
  });

  return httpServer;
}
