import express, { Router, type RequestHandler } from "express";
import { createServer as createHttpServer } from "http";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "../../logger.js";
import { LiveUpdateService } from "./services/live.service.js";
import type { DatabaseManager } from "../db/database.js";
import type { EventManager } from "../events/EventManager.js";
import type { ActionManager } from "./entities/actions/ActionManager.js";
import type { UserManager } from "./entities/users/userManager.js";
import type { SettingManager } from "./entities/settings/settingManager.js";
import type { FloorplanManager } from "./entities/floorplan/floorplanManager.js";
import { DeviceManager } from "./entities/devices/deviceManager.js";
import { SceneManager } from "./entities/scenes/sceneManager.js";
import { createUserRouter } from "./services/user.service.js";
import { createSettingsRouter } from "./services/settings.service.js";
import { createSceneRouter } from "./services/scene.service.js";
import { createModuleRouter } from "./services/module.service.js";
import { createDeviceRouter } from "./services/device.service.js";
import { createActionRouter } from "./services/action.service.js";
import { createFloorPlanRouter } from "./services/floorplan.service.js";

export type ServerDeps = {
  databaseManager: DatabaseManager;
  eventManager: EventManager;
  floorplanManager: FloorplanManager;
  settingManager: SettingManager;
  sceneManager: SceneManager;
  deviceManager: DeviceManager;
  userManager: UserManager;
  actionManager: ActionManager;
};

export function createApiRouter(deps: ServerDeps) {
  const router = Router();

  router.use("/users", createUserRouter(deps));
  router.use("/settings", createSettingsRouter(deps));
  router.use("/scenes", createSceneRouter(deps));
  router.use("/modules", createModuleRouter(deps));
  router.use("/devices", createDeviceRouter(deps));
  router.use("/actions", createActionRouter(deps));
  router.use("/floorplan", createFloorPlanRouter(deps));

  return router;
}

export function createServer(deps: ServerDeps) {
  const app = express();
  const httpServer = createHttpServer(app);
  const liveUpdateService = new LiveUpdateService(httpServer);

  deps.actionManager.setLiveUpdateService(liveUpdateService);
  deps.sceneManager.setLiveUpdateService(liveUpdateService);
  deps.deviceManager.setLiveUpdateService(liveUpdateService);
  deps.floorplanManager.setLiveUpdateService(liveUpdateService);
  deps.settingManager.setLiveUpdateService(liveUpdateService);
  deps.userManager.setLiveUpdateService(liveUpdateService);

  const httpLogger = (pinoHttp as unknown as (opts: { logger: typeof logger }) => RequestHandler)({
    logger
  });
  app.use(httpLogger);
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  app.use(
    "/api",
    createApiRouter(deps)
  );

  app.use((req, res) => {
    res.status(404).json({ error: `Endpoint not found: ${req.path}` });
  });

  return httpServer;
}
