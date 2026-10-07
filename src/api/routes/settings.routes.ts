import { Router } from "express";
import { SettingsRepository } from "../../db/repositories/SettingsRepository.js";
import { Request_DeleteAllData } from "../../model/requests/Request_DeleteAllData.js";
import { Request_FactoryReset } from "../../model/requests/Request_FactoryReset.js";
import { Request_GetSettings } from "../../model/requests/Request_GetSettings.js";
import { Request_UpdateNotificationSettings } from "../../model/requests/Request_UpdateNotificationSettings.js";
import { Request_UpdatePrivacySettings } from "../../model/requests/Request_UpdatePrivacySettings.js";
import { Request_UpdateSettings } from "../../model/requests/Request_UpdateSettings.js";
import { endpoint } from "../http/endpoint.js";
import { SettingsService } from "../services/settings.service.js";
import { settingsValidation } from "../validation/settings.validation.js";
import type { RouterDeps } from "../router.js";

export function createSettingsRouter(deps: RouterDeps) {
  const router = Router();
  const settingsService = new SettingsService(new SettingsRepository(deps.databaseManager));

  router.get("/", ...endpoint({
    schema: settingsValidation.getSettings,
    toRequest: () => new Request_GetSettings(),
    serve: request => settingsService.getSettings(request)
  }));

  router.put("/", ...endpoint({
    schema: settingsValidation.updateSettings,
    toRequest: ({ body }) => new Request_UpdateSettings(body),
    serve: request => settingsService.updateSettings(request)
  }));

  router.put("/notifications", ...endpoint({
    schema: settingsValidation.updateNotificationSettings,
    toRequest: ({ body }) => new Request_UpdateNotificationSettings(body),
    serve: request => settingsService.updateNotificationSettings(request)
  }));

  router.put("/privacy", ...endpoint({
    schema: settingsValidation.updatePrivacySettings,
    toRequest: ({ body }) => new Request_UpdatePrivacySettings(body),
    serve: request => settingsService.updatePrivacySettings(request)
  }));

  router.delete("/data", ...endpoint({
    schema: settingsValidation.deleteAllData,
    toRequest: () => new Request_DeleteAllData(),
    serve: request => settingsService.deleteAllData(request),
    status: 204
  }));

  router.delete("/factory-reset", ...endpoint({
    schema: settingsValidation.factoryReset,
    toRequest: () => new Request_FactoryReset(),
    serve: request => settingsService.factoryReset(request)
  }));

  return router;
}
