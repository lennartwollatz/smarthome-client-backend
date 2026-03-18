import { Router } from "express";
import { createActionRouter } from "./services/action.service.js";
import { createConfigRouter } from "./services/config.service.js";
import { createDeviceRouter } from "./services/device.service.js";
import { createFloorPlanRouter } from "./services/floorplan.service.js";
import { createModuleRouter } from "./services/module.service.js";
import { createSceneRouter } from "./services/scene.service.js";
import { createSettingsRouter } from "./services/settings.service.js";
import { createSystemRouter } from "./services/system.service.js";
import { createUserRouter } from "./services/user.service.js";
import type { DatabaseManager } from "../db/database.js";
import type { EventManager } from "../events/EventManager.js";
import type { ActionManager } from "../actions/ActionManager.js";

export type RouterDeps = {
  databaseManager: DatabaseManager;
  eventManager: EventManager;
  actionManager: ActionManager;
};

export function createApiRouter(deps: RouterDeps) {
  const router = Router();

  router.use("/config", createConfigRouter());
  router.use("/users", createUserRouter(deps));
  router.use("/settings/system", createSystemRouter(deps));
  router.use("/settings", createSettingsRouter(deps));
  router.use("/scenes", createSceneRouter(deps));
  router.use("/modules", createModuleRouter(deps));
  router.use("/devices", createDeviceRouter(deps));
  router.use("/actions", createActionRouter(deps));
  router.use("/floorplan", createFloorPlanRouter(deps));

  return router;
}

