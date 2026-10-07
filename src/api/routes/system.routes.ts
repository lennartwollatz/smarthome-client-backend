import { Router } from "express";
import { SettingsRepository } from "../../db/repositories/SettingsRepository.js";
import { Request_GetSystemInfo } from "../../model/requests/Request_GetSystemInfo.js";
import { Request_InstallUpdate } from "../../model/requests/Request_InstallUpdate.js";
import { Request_UpdateAutoUpdateSettings } from "../../model/requests/Request_UpdateAutoUpdateSettings.js";
import { endpoint } from "../http/endpoint.js";
import { SettingsService } from "../services/settings.service.js";
import { SystemService } from "../services/system.service.js";
import { systemValidation } from "../validation/system.validation.js";
import type { RouterDeps } from "../router.js";

export function createSystemRouter(deps: RouterDeps) {
  const router = Router();
  const systemService = new SystemService(new SettingsService(new SettingsRepository(deps.databaseManager)));

  router.get("/info", ...endpoint({
    schema: systemValidation.getSystemInfo,
    toRequest: () => new Request_GetSystemInfo(),
    serve: request => systemService.getSystemInfo(request)
  }));

  router.post("/install-update", ...endpoint({
    schema: systemValidation.installUpdate,
    toRequest: ({ body }) => new Request_InstallUpdate(body),
    serve: request => systemService.installUpdate(request)
  }));

  router.put("/auto-update", ...endpoint({
    schema: systemValidation.updateAutoUpdateSettings,
    toRequest: ({ body }) => new Request_UpdateAutoUpdateSettings(body),
    serve: request => systemService.updateAutoUpdateSettings(request)
  }));

  return router;
}
