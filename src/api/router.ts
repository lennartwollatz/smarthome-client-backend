import { Router } from "express";
import { authenticate } from "./middleware/authenticate.js";
import { createActionRouter } from "./routes/action.routes.js";
import { createConfigRouter } from "./routes/config.routes.js";
import { createDeviceRouter } from "./routes/device.routes.js";
import { createFloorPlanRouter } from "./routes/floorplan.routes.js";
import { createModuleRouter } from "./routes/module.routes.js";
import { createSceneRouter } from "./routes/scene.routes.js";
import { createSettingsRouter } from "./routes/settings.routes.js";
import { createSystemRouter } from "./routes/system.routes.js";
import { createUserRouter } from "./routes/user.routes.js";
import type { DatabaseManager } from "../db/database.js";
import type { EventManager } from "../events/EventManager.js";
import type { ActionManager } from "../actions/ActionManager.js";
import type { MatterPresenceDeviceManager } from "../modules/presence/MatterPresenceDeviceManager.js";
import type { MatterVoiceAssistantManager } from "../modules/voiceassistant/MatterVoiceAssistantManager.js";

export type RouterDeps = {
  databaseManager: DatabaseManager;
  eventManager: EventManager;
  actionManager: ActionManager;
  presenceManager: MatterPresenceDeviceManager;
  voiceAssistantManager: MatterVoiceAssistantManager;
};

export function createApiRouter(deps: RouterDeps) {
  const router = Router();

  router.use(authenticate);

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

