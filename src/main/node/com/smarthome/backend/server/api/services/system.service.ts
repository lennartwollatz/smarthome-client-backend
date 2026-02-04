import { Router } from "express";
import type { DatabaseManager } from "../../db/database.js";
import { JsonRepository } from "../../db/jsonRepository.js";
import { loadOrCreateSettings, saveSettings } from "./settings.service.js";
import type {
  Settings,
  SystemSettings,
  SystemInfo,
  UpdateComponentRequest,
  AutoUpdateSettings
} from "../../../model/index.js";

type Deps = {
  databaseManager: DatabaseManager;
};

export function createSystemRouter(deps: Deps) {
  const router = Router();
  const settingsRepository = new JsonRepository<Settings>(deps.databaseManager, "Settings");

  router.get("/info", (_req, res) => {
    const settings = loadOrCreateSettings(settingsRepository);
    const systemSettings = (settings.system ?? {}) as SystemSettings;
    const systemInfo: SystemInfo = {
      frontend: systemSettings.frontend,
      backend: systemSettings.backend,
      serverIp: systemSettings.serverIp
    };
    res.status(200).json(systemInfo);
  });

  router.post("/install-update", (req, res) => {
    const request = req.body as UpdateComponentRequest;
    const settings = loadOrCreateSettings(settingsRepository);
    const systemSettings = (settings.system ?? {}) as SystemSettings;

    if (request.component === "frontend" && systemSettings.frontend) {
      systemSettings.frontend.currentVersion = systemSettings.frontend.latestVersion;
      systemSettings.frontend.hasUpdate = false;
    } else if (request.component === "backend" && systemSettings.backend) {
      systemSettings.backend.currentVersion = systemSettings.backend.latestVersion;
      systemSettings.backend.hasUpdate = false;
    }

    settings.system = systemSettings;
    saveSettings(settingsRepository, settings);

    const response: SystemInfo = {
      frontend: systemSettings.frontend,
      backend: systemSettings.backend,
      serverIp: systemSettings.serverIp
    };
    res.status(200).json(response);
  });

  router.put("/auto-update", (req, res) => {
    const autoUpdate = req.body as AutoUpdateSettings;
    const settings = loadOrCreateSettings(settingsRepository);
    const systemSettings = (settings.system ?? {}) as SystemSettings;

    if (autoUpdate.autoupdate != null) {
      systemSettings.autoupdate = autoUpdate.autoupdate;
    }
    if (autoUpdate.updatetimes != null) {
      systemSettings.updatetimes = autoUpdate.updatetimes;
    }

    settings.system = systemSettings;
    saveSettings(settingsRepository, settings);
    res.status(200).json(autoUpdate);
  });

  return router;
}

