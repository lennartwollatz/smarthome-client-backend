import { Router } from "express";
import { ModuleRepository } from "../../db/repositories/ModuleRepository.js";
import { Request_GetModule } from "../../model/requests/Request_GetModule.js";
import { Request_GetModules } from "../../model/requests/Request_GetModules.js";
import { Request_InstallModule } from "../../model/requests/Request_InstallModule.js";
import { Request_SetModuleActive } from "../../model/requests/Request_SetModuleActive.js";
import { Request_UninstallModule } from "../../model/requests/Request_UninstallModule.js";
import { Request_UpdateModule } from "../../model/requests/Request_UpdateModule.js";
import { Request_UpdateModuleSettings } from "../../model/requests/Request_UpdateModuleSettings.js";
import { endpoint } from "../http/endpoint.js";
import { ModuleService } from "../services/module.service.js";
import { moduleValidation } from "../validation/module.validation.js";
import { createDenonModuleRouter } from "./modules/denon.routes.js";
import { createHueModuleRouter } from "./modules/hue.routes.js";
import { createLGModuleRouter } from "./modules/lg.routes.js";
import { createMatterModuleRouter } from "./modules/matter.routes.js";
import { createPresenceModuleRouter } from "./modules/presence.routes.js";
import { createSonosModuleRouter } from "./modules/sonos.routes.js";
import { createWACLightingModuleRouter } from "./modules/waclighting.routes.js";
import { createXiaomiModuleRouter } from "./modules/xiaomi.routes.js";
import { createBMWModuleRouter } from "./modules/bmw.routes.js";
import { createAppleCalendarModuleRouter } from "./modules/appleCalendar.routes.js";
import { createCalendarModuleRouter } from "./modules/calendar.routes.js";
import { createWeatherModuleRouter } from "./modules/weather.routes.js";
import type { RouterDeps } from "../router.js";

export function createModuleRouter(deps: RouterDeps) {
  const router = Router();
  const moduleService = new ModuleService(new ModuleRepository(deps.databaseManager), deps.actionManager);

  // Parametrisierte Routen ZUERST, damit /:moduleId/install vor router.use("/weather") greift
  router.get("/", ...endpoint({
    schema: moduleValidation.getModules,
    toRequest: () => new Request_GetModules(),
    serve: request => moduleService.getModules(request)
  }));

  router.get("/:moduleId/install", ...endpoint({
    schema: moduleValidation.installModule,
    toRequest: ({ params }) => new Request_InstallModule(params),
    serve: request => moduleService.installModule(request)
  }));

  router.get("/:moduleId/uninstall", ...endpoint({
    schema: moduleValidation.uninstallModule,
    toRequest: ({ params }) => new Request_UninstallModule(params),
    serve: request => moduleService.uninstallModule(request)
  }));

  router.put("/:moduleId/settings", ...endpoint({
    schema: moduleValidation.updateModuleSettings,
    toRequest: ({ params }) => new Request_UpdateModuleSettings(params),
    serve: request => moduleService.updateModuleSettings(request)
  }));

  router.get("/:moduleId", ...endpoint({
    schema: moduleValidation.getModule,
    toRequest: ({ params }) => new Request_GetModule(params),
    serve: request => moduleService.getModule(request)
  }));

  router.put("/:moduleId", ...endpoint({
    schema: moduleValidation.updateModule,
    toRequest: ({ params, body }) => new Request_UpdateModule({ ...body, moduleId: params.moduleId }),
    serve: request => moduleService.updateModule(request)
  }));

  router.post("/:moduleId", ...endpoint({
    schema: moduleValidation.setModuleActive,
    toRequest: ({ params, body }) => new Request_SetModuleActive({ ...body, moduleId: params.moduleId }),
    serve: request => moduleService.setModuleActive(request)
  }));

  // Modul-spezifische Sub-Router NACH den parametrisierten Routen,
  // damit /:moduleId/install etc. vor router.use("/weather") greift
  router.use("/calendar", createCalendarModuleRouter(deps));
  router.use("/calendar-apple", createAppleCalendarModuleRouter(deps));
  router.use("/denon", createDenonModuleRouter(deps));
  router.use("/matter", createMatterModuleRouter(deps));
  router.use("/presence", createPresenceModuleRouter(deps));
  router.use("/hue", createHueModuleRouter(deps));
  router.use("/lg", createLGModuleRouter(deps));
  router.use("/sonos", createSonosModuleRouter(deps));
  router.use("/waclighting", createWACLightingModuleRouter(deps));
  router.use("/bmw", createBMWModuleRouter(deps));
  router.use("/weather", createWeatherModuleRouter(deps));
  router.use("/xiaomi", createXiaomiModuleRouter(deps));

  return router;
}
