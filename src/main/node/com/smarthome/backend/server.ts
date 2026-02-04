import express, { type RequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./logger.js";
import { createApiRouter } from "./server/api/router.js";
import type { DatabaseManager } from "./server/db/database.js";
import type { EventStreamManager } from "./server/events/eventStreamManager.js";
import type { ActionManager } from "./server/actions/actionManager.js";
import { MatterModuleManager } from "./server/api/modules/matter/matterModuleManager.js";
import { MatterController } from "./server/api/modules/matter/matterController.js";
import { NodeId } from "@matter/types";

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

  //TESTS
  /*
  const moduleManager:MatterModuleManager = new MatterModuleManager(deps.databaseManager, deps.eventStreamManager, deps.actionManager);
  moduleManager.pairDevice("matter-0BAD8837EDE1D4DA._matterc._udp.local", { pairingCode: "23865827150" });
  const controller = new MatterController(deps.databaseManager);
  //const nodeId = moduleManager.resolveNodeId("matter-0BAD8837EDE1D4DA._matterc._udp.local");
  //if(nodeId) {
    controller.getNode(NodeId(BigInt("7198344289035890142"))).then((node) => {
      console.log("node" + JSON.stringify(node));
    });
  //}
  return app;
  */
 return app;
}

