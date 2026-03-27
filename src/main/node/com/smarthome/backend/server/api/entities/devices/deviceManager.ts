import { logger } from "../../../../logger.js";
import { Device } from "../../../../model/devices/Device.js";
import type { DatabaseManager } from "../../../db/database.js";
import { JsonRepository } from "../../../db/jsonRepository.js";
import { EventManager } from "../../../events/EventManager.js";
import type { LiveUpdateService } from "../../services/live.service.js";
import type { ModuleManager } from "../../modules/moduleManager.js";
import { EntityManager } from "../EntityManager.js";

export class DeviceManager implements EntityManager {
  private deviceRepository: JsonRepository<Device>;
  private moduleManagers = new Map<string, ModuleManager<any, any, any, any, any, any, any>>();
  private liveUpdateService?: LiveUpdateService;
  private devices = new Map<string, Device>();

  constructor(databaseManager: DatabaseManager, private eventManager: EventManager) {
    this.deviceRepository = new JsonRepository<Device>(databaseManager, "Device");
    this.initialize();
  }

  initialize() {
    this.loadDevicesFromDatabase();
  }

  setLiveUpdateService(service: LiveUpdateService): void {
    this.liveUpdateService = service;
  }

  loadDevicesFromDatabase(): void {
    const devices = this.deviceRepository.findAll();
    devices.forEach(device => {
      if (device?.id) {
        this.devices.set(device.id, device);
      }
    });
  }

  registerModuleManager(moduleManager: ModuleManager<any, any, any, any, any, any, any>): void {
    const moduleId = moduleManager.getModuleId();
    this.moduleManagers.set(moduleId, moduleManager);
    const convertPromises = this.getDevicesForModule(moduleId).map(async device => {
      const convertedDevice = await moduleManager.convertDeviceFromDatabase(device);
      if (!convertedDevice) return;
      this.devices.set(device.id, convertedDevice);
    });
    Promise.all(convertPromises)
      .then(async () => await moduleManager.initializeDeviceControllers())
      .then(async () => moduleManager.updateDeviceValues())
      .then(() => moduleManager.startEventStreamsAfterRegistration())
      .catch(err => {
        logger.error({ err, moduleId }, "Fehler beim Initialisieren der Device-Controller");
      });
  }

  restartEventStreamForModule(moduleId: string): void {
    const mgr = this.moduleManagers.get(moduleId);
    if (mgr && typeof (mgr as { restartEventStream?: () => void }).restartEventStream === "function") {
      (mgr as { restartEventStream: () => void }).restartEventStream();
    }
  }

  removeRoomFromDevices(roomId: string): void {
    if (!roomId) return;
    this.devices.forEach(device => {
      if (device.room === roomId) {
        device.room = undefined;
        if (device.id) {
          this.deviceRepository.save(device.id, device);
          if (device.moduleId !== "voice-assistant") {
            this.liveUpdateService?.emit("device:updated", device);
          }
        }
      }
    });
  }

  removeDevicesForModule(moduleId: string): void {
    if (!moduleId) return;
    const devicesToRemove = this.getDevicesForModule(moduleId);
    for (const device of devicesToRemove) {
      this.eventManager.removeListenerForDevice(device.id);
      this.devices.delete(device.id);
      //TODO: prüfen, ob das einfluss auf die Actions hat.
    }
  }

  removeDevice(deviceId: string): boolean {
    if (!deviceId) return false;
    const device = this.devices.get(deviceId);
    const isVoiceAssistant = device?.moduleId === "voice-assistant";
    this.eventManager.removeListenerForDevice(deviceId);
    this.devices.delete(deviceId);
    this.deviceRepository.deleteById(deviceId);
    //TODO: prüfen, ob das einfluss auf die Actions hat.
    if (!isVoiceAssistant) {
      this.liveUpdateService?.emit("device:removed", { deviceId });
    }
    return true;
  }

  saveDevices(devices: Device[]): boolean {
    return devices.every(device => this.saveDevice(device));
  }

  saveDevice(device: Device): boolean {
    if (!device?.id) return false;
    this.devices.set(device.id, device);
    this.deviceRepository.save(device.id, device);
    if (device.moduleId !== "voice-assistant") {
      this.liveUpdateService?.emit("device:updated", device);
    }
    return true;
  }

  /**
   * Wendet den JSON-Body von PUT /api/devices/:id an (Metadaten, Buttons, Koordinaten).
   * `temperatureGoal` ist nicht erlaubt (nur über das Matter-Modul).
   * @returns aktualisiertes Gerät oder `null`, wenn kein Gerät existiert oder der Patch ungültig ist.
   */
  updateDeviceSettings(deviceId: string, patch: Record<string, unknown>): Device | null {
    const existing = this.getDevice(deviceId);
    if (!existing) {
      return null;
    }
    if ("temperatureGoal" in patch) {
      return null;
    }

    this.applyApiPatchToDevice(existing, patch);
    this.saveDevice(existing);
    return existing;
  }

  private applyApiPatchToDevice(device: Device, patch: Record<string, unknown>): void {
    const next = device as Device & Record<string, unknown>;

    if ("name" in patch && typeof patch.name === "string") next.name = patch.name;
    if ("room" in patch && (typeof patch.room === "string" || patch.room === undefined || patch.room === null)) {
      next.room = patch.room ?? undefined;
    }
    if ("icon" in patch && (typeof patch.icon === "string" || patch.icon === undefined)) next.icon = patch.icon;
    if ("typeLabel" in patch && (typeof patch.typeLabel === "string" || patch.typeLabel === undefined)) {
      next.typeLabel = patch.typeLabel;
    }
    if ("quickAccess" in patch && typeof patch.quickAccess === "boolean") next.quickAccess = patch.quickAccess;
    if ("latitude" in patch && typeof patch.latitude === "number" && Number.isFinite(patch.latitude)) {
      next.latitude = patch.latitude;
    }
    if ("longitude" in patch && typeof patch.longitude === "number" && Number.isFinite(patch.longitude)) {
      next.longitude = patch.longitude;
    }
    if ("roomMapping" in patch && typeof patch.roomMapping === "object" && patch.roomMapping !== null) {
      next.roomMapping = patch.roomMapping as Record<string, string>;
    }
    if ("buttons" in patch && typeof patch.buttons === "object" && patch.buttons !== null) {
      const incomingButtons = patch.buttons as Record<string, unknown>;
      const existingButtons = next.buttons as Record<string, Record<string, unknown>> | undefined;

      if (existingButtons && typeof existingButtons === "object") {
        for (const [buttonId, rawButtonPatch] of Object.entries(incomingButtons)) {
          const existingButton = existingButtons[buttonId];
          if (!existingButton || typeof existingButton !== "object") continue;
          if (!rawButtonPatch || typeof rawButtonPatch !== "object") continue;

          const buttonPatch = rawButtonPatch as Record<string, unknown>;
          if ("name" in buttonPatch && typeof buttonPatch.name === "string") {
            existingButton.name = buttonPatch.name;
          }
          if ("connectedToLight" in buttonPatch && typeof buttonPatch.connectedToLight === "boolean") {
            existingButton.connectedToLight = buttonPatch.connectedToLight;
          }
        }
      }
    }
  }

  getDevice(deviceId: string): Device | null {
    return this.devices.get(deviceId) ?? null;
  }

  getDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  getDevicesMap(): Map<string, Device> {
    return this.devices;
  }

  getDevicesForModule(moduleId: string): Device[] {
    return Array.from(this.getDevices()).filter(device => device.moduleId === moduleId);
  }

  addDevicesForModule(moduleId: string): void {
    const devices = this.getDevicesForModule(moduleId);
    for (const device of devices) {
      this.saveDevice(device);
    }
  }
}
