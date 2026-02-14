import { Router } from "express";
import type { DatabaseManager } from "../../db/database.js";
import type { EventStreamManager } from "../../events/eventStreamManager.js";
import type { ActionManager } from "../../actions/actionManager.js";
import { JsonRepository } from "../../db/jsonRepository.js";
import { defaultModuleById, getDefaultModules, type ModuleModel } from "../modules/modules.js";
import { createDenonModuleRouter } from "./modules/denonModule.service.js";
import { createHueModuleRouter } from "./modules/hueModule.service.js";
import { createLGModuleRouter } from "./modules/lgModule.service.js";
import { createMatterModuleRouter } from "./modules/matterModule.service.js";
import { createSonosModuleRouter } from "./modules/sonosModule.service.js";
import { createWACLightingModuleRouter } from "./modules/waclightingModule.service.js";
import { createBMWModuleRouter } from "./modules/bmwModule.service.js";

type Deps = {
  databaseManager: DatabaseManager;
  eventStreamManager: EventStreamManager;
  actionManager: ActionManager;
};

export function createModuleRouter(deps: Deps) {
  const router = Router();
  const moduleRepository = new JsonRepository<ModuleModel>(deps.databaseManager, "Module");

  router.use("/denon", createDenonModuleRouter(deps));
  router.use("/matter", createMatterModuleRouter(deps));
  router.use("/hue", createHueModuleRouter(deps));
  router.use("/lg", createLGModuleRouter(deps));
  router.use("/sonos", createSonosModuleRouter(deps));
  router.use("/waclighting", createWACLightingModuleRouter(deps));
  router.use("/bmw", createBMWModuleRouter(deps));

  router.get("/", (_req, res) => {
    const modules = enrichWithDefaultModules(moduleRepository.findAll());
    const modulesForApi = modules.map(removeSensitiveDataFromModule);
    res.status(200).json(modulesForApi);
  });

  router.get("/:moduleId/install", (req, res) => {
    const module = getOrCreateModule(moduleRepository, req.params.moduleId);
    module.isInstalled = true;
    module.isActive = true;
    deps.actionManager.addDevicesForModule(req.params.moduleId);
    moduleRepository.save(req.params.moduleId, module);
    res.status(200).json(true);
  });

  router.get("/:moduleId/uninstall", (req, res) => {
    const module = getOrCreateModule(moduleRepository, req.params.moduleId);
    module.isInstalled = false;
    module.isActive = false;
    deps.actionManager.removeDeviceForModule(req.params.moduleId);
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
    module.isActive = Boolean(request.isActive);
    if (module.isActive) {
      deps.actionManager.addDevicesForModule(req.params.moduleId);
    } else {
      deps.actionManager.removeDeviceForModule(req.params.moduleId);
    }
    moduleRepository.save(req.params.moduleId, module);
    res.status(200).json(module.isActive);
  });

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

