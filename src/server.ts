import express, { type RequestHandler } from "express";
import { createServer as createHttpServer } from "http";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./config/logger.js";
import { createApiRouter } from "./api/router.js";
import { errorHandler, notFoundHandler } from "./api/middleware/errorHandler.js";
import { LiveUpdateService } from "./live/LiveUpdateService.js";
import type { DatabaseManager } from "./db/database.js";
import type { EventManager } from "./events/EventManager.js";
import type { ActionManager } from "./actions/ActionManager.js";
import type { MatterPresenceDeviceManager } from "./modules/presence/MatterPresenceDeviceManager.js";
import type { MatterVoiceAssistantManager } from "./modules/voiceassistant/MatterVoiceAssistantManager.js";

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
  app.use(notFoundHandler);
  app.use(errorHandler);

  return httpServer;
}
