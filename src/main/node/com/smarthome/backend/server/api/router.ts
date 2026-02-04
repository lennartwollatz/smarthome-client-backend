import { Router } from "express";
import { createActionRouter } from "./services/action.service.js";
import { createDeviceRouter } from "./services/device.service.js";
import { createFloorPlanRouter } from "./services/floorplan.service.js";
import { createModuleRouter } from "./services/module.service.js";
import { createSceneRouter } from "./services/scene.service.js";
import { createSettingsRouter } from "./services/settings.service.js";
import { createSystemRouter } from "./services/system.service.js";
import { createUserRouter } from "./services/user.service.js";
import type { DatabaseManager } from "../db/database.js";
import type { EventStreamManager } from "../events/eventStreamManager.js";
import type { ActionManager } from "../actions/actionManager.js";

type RouterDeps = {
  databaseManager: DatabaseManager;
  eventStreamManager: EventStreamManager;
  actionManager: ActionManager;
};

export function createApiRouter(deps: RouterDeps) {
  const router = Router();

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

