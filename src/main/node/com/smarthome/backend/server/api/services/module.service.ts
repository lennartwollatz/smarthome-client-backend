import { Router } from "express";
import { JsonRepository } from "../../db/jsonRepository.js";
import { defaultModuleById, getDefaultModules, type ModuleModel } from "../modules/modules.js";
import { createDenonModuleRouter } from "./modules/denonModule.service.js";
import { createHueModuleRouter } from "./modules/hueModule.service.js";
import { createLGModuleRouter } from "./modules/lgModule.service.js";
import { createMatterModuleRouter } from "./modules/matterModule.service.js";
import { createPresenceModuleRouter } from "./modules/presenceModule.service.js";
import { createSonosModuleRouter } from "./modules/sonosModule.service.js";
import { createWACLightingModuleRouter } from "./modules/waclightingModule.service.js";
import { createXiaomiModuleRouter } from "./modules/xiaomiModule.service.js";
import { createBMWModuleRouter } from "./modules/bmwModule.service.js";
import { createAppleCalendarModuleRouter } from "./modules/appleCalendarModule.service.js";
import { createCalendarModuleRouter } from "./modules/calendarModule.service.js";
import { createWeatherModuleRouter } from "./modules/weatherModule.service.js";
import type { RouterDeps } from "../router.js";
import { DeviceWeather } from "../../../model/devices/DeviceWeather.js";
import { DeviceType } from "../../../model/devices/helper/DeviceType.js";
import crypto from "node:crypto";

export function createModuleRouter(deps: RouterDeps) {
  const router = Router();
  const moduleRepository = new JsonRepository<ModuleModel>(deps.databaseManager, "Module");

  // Parametrisierte Routen ZUERST, damit /:moduleId/install vor router.use("/weather") greift
  router.get("/", (_req, res) => {
    const modules = enrichWithDefaultModules(moduleRepository.findAll());
    // Wenn Weather-Modul installiert und aktiv: genau ein Gerät sicherstellen
    const weatherMod = modules.find((m) => m.id === "weather" && m.isInstalled && m.isActive);
    if (weatherMod) {
      ensureDefaultWeatherDeviceIfNeeded("weather", deps);
    }
    const modulesForApi = modules.map(removeSensitiveDataFromModule);
    res.status(200).json(modulesForApi);
  });

  router.get("/:moduleId/install", (req, res) => {
    if (req.params.moduleId === "calendar") {
      // Zentrales Kalender-Modul ist immer aktiv
      const module = getOrCreateModule(moduleRepository, req.params.moduleId);
      module.isInstalled = true;
      module.isActive = true;
      moduleRepository.save(req.params.moduleId, module);
      res.status(200).json(true);
      return;
    }
    const module = getOrCreateModule(moduleRepository, req.params.moduleId);
    module.isInstalled = true;
    module.isActive = true;
    ensureDefaultWeatherDeviceIfNeeded(req.params.moduleId, deps);
    deps.actionManager.addDevicesForModule(req.params.moduleId);
    moduleRepository.save(req.params.moduleId, module);
    res.status(200).json(true);
  });

  router.get("/:moduleId/uninstall", (req, res) => {
    if (req.params.moduleId === "calendar") {
      // Zentrales Kalender-Modul darf nicht deinstalliert werden
      const module = getOrCreateModule(moduleRepository, req.params.moduleId);
      module.isInstalled = true;
      module.isActive = true;
      moduleRepository.save(req.params.moduleId, module);
      res.status(200).json(true);
      return;
    }
    const module = getOrCreateModule(moduleRepository, req.params.moduleId);
    module.isInstalled = false;
    module.isActive = false;
    deps.actionManager.removeDevicesForModule(req.params.moduleId);
    moduleRepository.save(req.params.moduleId, module);
    res.status(200).json(true);
  });

  router.put("/:moduleId/settings", (req, res) => {
    const module = getOrCreateModule(moduleRepository, req.params.moduleId);
    moduleRepository.save(req.params.moduleId, module);
    res.status(200).json(module);
  });

  router.get("/:moduleId", (req, res) => {
    const module = moduleRepository.findById(req.params.moduleId);
    if (module) {
      res.status(200).json(removeSensitiveDataFromModule(module));
      return;
    }
    const fallback = defaultModuleById(req.params.moduleId);
    if (fallback) {
      res.status(200).json(fallback);
    } else {
      res.status(404).json({ error: "Module not found" });
    }
  });

  router.put("/:moduleId", (req, res) => {
    const module = req.body as ModuleModel;
    module.id = req.params.moduleId;
    moduleRepository.save(req.params.moduleId, module);
    res.status(200).json(module);
  });

  router.post("/:moduleId", (req, res) => {
    const request = req.body as { isActive?: boolean };
    const module = getOrCreateModule(moduleRepository, req.params.moduleId);
    if (req.params.moduleId === "calendar") {
      module.isActive = true;
      module.isInstalled = true;
      moduleRepository.save(req.params.moduleId, module);
      res.status(200).json(true);
      return;
    }
    module.isActive = Boolean(request.isActive);
    if (module.isActive) {
      ensureDefaultWeatherDeviceIfNeeded(req.params.moduleId, deps);
      deps.actionManager.addDevicesForModule(req.params.moduleId);
    } else {
      deps.actionManager.removeDevicesForModule(req.params.moduleId);
    }
    moduleRepository.save(req.params.moduleId, module);
    res.status(200).json(module.isActive);
  });

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

function enrichWithDefaultModules(dbModules: ModuleModel[]) {
  const map = new Map<string, ModuleModel>();
  dbModules.forEach(module => {
    if (module?.id) map.set(module.id, module);
  });
  for (const module of getDefaultModules()) {
    if (module.id && !map.has(module.id)) {
      map.set(module.id, module);
    }
  }
  return Array.from(map.values());
}

function removeSensitiveDataFromModule(module: ModuleModel) {
  if (!module?.moduleData) return module;

  if (module.id === "hue" && Array.isArray(module.moduleData.bridges)) {
    const filteredBridges = module.moduleData.bridges.map((bridge: Record<string, unknown>) => {
      const sanitized = { ...bridge };
      delete sanitized.username;
      delete sanitized.clientKey;
      return sanitized;
    });
    return {
      ...module,
      moduleData: {
        ...module.moduleData,
        bridges: filteredBridges
      }
    };
  }
  if (module.id === "bmw") {
    return {
      ...module,
      moduleData: {
        ...module.moduleData,
        password: undefined
      }
    };
  }
  return module;
}

function ensureDefaultWeatherDeviceIfNeeded(moduleId: string, deps: RouterDeps): void {
  if (moduleId !== "weather") return;
  const existing = deps.actionManager.getDevicesForModule("weather");
  if (existing.length > 0) return;
  const device = new DeviceWeather({
    id: crypto.randomUUID(),
    name: "Wetter",
    moduleId: "weather",
    type: DeviceType.WEATHER,
    latitude: 52.52,
    longitude: 13.41,
    isConnected: true,
    quickAccess: true,
  });
  deps.actionManager.saveDevice(device);
  deps.actionManager.restartEventStreamForModule("weather");
}

function getOrCreateModule(
  moduleRepository: JsonRepository<ModuleModel>,
  moduleId: string
) {
  const existing = moduleRepository.findById(moduleId);
  if (existing) return existing;
  const fallback = defaultModuleById(moduleId);
  if (fallback) {
    moduleRepository.save(moduleId, fallback);
    return fallback;
  }
  const fallbackModule = defaultModuleById(moduleId);
  if (!fallbackModule) {
    throw new Error(`Module ${moduleId} nicht gefunden`);
  }
  const module: ModuleModel = {
    ...fallbackModule,
    isInstalled: true,
    isActive: true
  };
  moduleRepository.save(moduleId, module);
  return module;
}

