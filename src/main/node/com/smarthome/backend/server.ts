import express, { type RequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./logger.js";
import { createApiRouter } from "./server/api/router.js";
import type { DatabaseManager } from "./server/db/database.js";
import type { EventStreamManager } from "./server/events/eventStreamManager.js";
import type { ActionManager } from "./server/actions/actionManager.js";

type ServerDeps = {
  databaseManager: DatabaseManager;
  eventStreamManager: EventStreamManager;
  actionManager: ActionManager;
};

export function createServer(deps: ServerDeps) {
  const app = express();

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

 return app;
}

