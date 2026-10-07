import { randomUUID } from "node:crypto";
import type { ActionManager } from "../../actions/ActionManager.js";
import type { ModuleRepository } from "../../db/repositories/ModuleRepository.js";
import { DeviceWeather } from "../../model/devices/DeviceWeather.js";
import { DeviceType } from "../../model/devices/helper/DeviceType.js";
import type { Request_GetModule } from "../../model/requests/Request_GetModule.js";
import type { Request_GetModules } from "../../model/requests/Request_GetModules.js";
import type { Request_InstallModule } from "../../model/requests/Request_InstallModule.js";
import type { Request_SetModuleActive } from "../../model/requests/Request_SetModuleActive.js";
import type { Request_UninstallModule } from "../../model/requests/Request_UninstallModule.js";
import type { Request_UpdateModule } from "../../model/requests/Request_UpdateModule.js";
import type { Request_UpdateModuleSettings } from "../../model/requests/Request_UpdateModuleSettings.js";
import { Response_GetModule } from "../../model/responses/Response_GetModule.js";
import { Response_GetModules } from "../../model/responses/Response_GetModules.js";
import { Response_InstallModule } from "../../model/responses/Response_InstallModule.js";
import { Response_Module } from "../../model/responses/Response_Module.js";
import { Response_SetModuleActive } from "../../model/responses/Response_SetModuleActive.js";
import { Response_UninstallModule } from "../../model/responses/Response_UninstallModule.js";
import { Response_UpdateModule } from "../../model/responses/Response_UpdateModule.js";
import { Response_UpdateModuleSettings } from "../../model/responses/Response_UpdateModuleSettings.js";
import { defaultModuleById, getDefaultModules, type ModuleModel } from "../../modules/modules.js";
import { ApiError } from "../http/ApiError.js";

const MODULE_NOT_FOUND = "Module not found";
/** Das zentrale Kalender-Modul ist immer installiert und aktiv. */
const CALENDAR_MODULE_ID = "calendar";
const WEATHER_MODULE_ID = "weather";

export class ModuleService {
  constructor(
    private readonly moduleRepository: ModuleRepository,
    private readonly actionManager: ActionManager
  ) {}

  async getModules(_request: Request_GetModules): Promise<Response_GetModules> {
    const modules = withDefaultModules(await this.moduleRepository.findAll());
    if (modules.some(module => module.id === WEATHER_MODULE_ID && module.isInstalled && module.isActive)) {
      this.ensureDefaultWeatherDevice();
    }
    return new Response_GetModules(modules.map(module => new Response_Module(module)));
  }

  async installModule(request: Request_InstallModule): Promise<Response_InstallModule> {
    const module = await this.getOrCreateModule(request.moduleId);
    module.isInstalled = true;
    module.isActive = true;
    if (request.moduleId !== CALENDAR_MODULE_ID) {
      if (request.moduleId === WEATHER_MODULE_ID) this.ensureDefaultWeatherDevice();
      this.actionManager.addDevicesForModule(request.moduleId);
    }
    await this.moduleRepository.save(module);
    return new Response_InstallModule();
  }

  async uninstallModule(request: Request_UninstallModule): Promise<Response_UninstallModule> {
    const module = await this.getOrCreateModule(request.moduleId);
    if (request.moduleId === CALENDAR_MODULE_ID) {
      module.isInstalled = true;
      module.isActive = true;
    } else {
      module.isInstalled = false;
      module.isActive = false;
      this.actionManager.removeDevicesForModule(request.moduleId);
    }
    await this.moduleRepository.save(module);
    return new Response_UninstallModule();
  }

  async updateModuleSettings(request: Request_UpdateModuleSettings): Promise<Response_UpdateModuleSettings> {
    return new Response_UpdateModuleSettings(await this.getOrCreateModule(request.moduleId));
  }

  async getModule(request: Request_GetModule): Promise<Response_GetModule> {
    const module = (await this.moduleRepository.findById(request.moduleId)) ?? defaultModuleById(request.moduleId);
    if (!module) throw ApiError.notFound(MODULE_NOT_FOUND);
    return new Response_GetModule(module);
  }

  async updateModule(request: Request_UpdateModule): Promise<Response_UpdateModule> {
    const module: ModuleModel = {
      id: request.moduleId,
      name: request.name,
      shortDescription: request.shortDescription,
      longDescription: request.longDescription,
      categoryKey: request.categoryKey,
      icon: request.icon,
      isInstalled: request.isInstalled ?? undefined,
      isActive: request.isActive ?? undefined,
      isPurchased: request.isPurchased ?? undefined,
      isDisabled: request.isDisabled ?? undefined,
      price: request.price,
      features: request.features,
      version: request.version,
      devices: request.devices,
      moduleData: request.moduleData ?? undefined
    };
    await this.moduleRepository.save(module);
    return new Response_UpdateModule(module);
  }

  async setModuleActive(request: Request_SetModuleActive): Promise<Response_SetModuleActive> {
    const module = await this.getOrCreateModule(request.moduleId);
    if (request.moduleId === CALENDAR_MODULE_ID) {
      module.isInstalled = true;
      module.isActive = true;
    } else {
      module.isActive = request.isActive ?? false;
      if (module.isActive) {
        if (request.moduleId === WEATHER_MODULE_ID) this.ensureDefaultWeatherDevice();
        this.actionManager.addDevicesForModule(request.moduleId);
      } else {
        this.actionManager.removeDevicesForModule(request.moduleId);
      }
    }
    await this.moduleRepository.save(module);
    return new Response_SetModuleActive(module.isActive);
  }

  private async getOrCreateModule(moduleId: string): Promise<ModuleModel> {
    const existing = await this.moduleRepository.findById(moduleId);
    if (existing) return existing;
    const fallback = defaultModuleById(moduleId);
    if (!fallback) throw ApiError.notFound(MODULE_NOT_FOUND);
    await this.moduleRepository.save(fallback);
    return fallback;
  }

  /** Legt genau ein Wetter-Gerät an, solange das Wetter-Modul noch keines hat. */
  private ensureDefaultWeatherDevice(): void {
    if (this.actionManager.getDevicesForModule(WEATHER_MODULE_ID).length > 0) return;
    this.actionManager.saveDevice(new DeviceWeather({
      id: randomUUID(),
      name: "Wetter",
      moduleId: WEATHER_MODULE_ID,
      type: DeviceType.WEATHER,
      latitude: 52.52,
      longitude: 13.41,
      isConnected: true,
      quickAccess: true
    }));
    this.actionManager.restartEventStreamForModule(WEATHER_MODULE_ID);
  }
}

/** Ergänzt die gespeicherten Module um alle Standardmodule, die noch nicht gespeichert sind. */
function withDefaultModules(storedModules: ModuleModel[]): ModuleModel[] {
  const modules = new Map(storedModules.map(module => [module.id, module]));
  for (const module of getDefaultModules()) {
    if (!modules.has(module.id)) modules.set(module.id, module);
  }
  return Array.from(modules.values());
}
