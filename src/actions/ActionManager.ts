import { logger } from "../config/logger.js";
import { Action } from "./action/Action.js";
import { Scene } from "./scene/Scene.js";
import type { ModuleManager } from "../modules/moduleManager.js";
import type { DatabaseManager } from "../db/database.js";
import { ActionRepository } from "../db/repositories/ActionRepository.js";
import { DeviceRepository } from "../db/repositories/DeviceRepository.js";
import { SceneRepository } from "../db/repositories/SceneRepository.js";
import { EventManager } from "../events/EventManager.js";
import { STANDARD_SCENE_DEFINITIONS } from "./scene/sceneDefinitions.js";
import { Device } from "../model/devices/Device.js";
import type { LiveUpdateService } from "../live/LiveUpdateService.js";


export class ActionManager {
  private actionRepository: ActionRepository;
  private sceneRepository: SceneRepository;
  private deviceRepository: DeviceRepository;
  private moduleManagers = new Map<string, ModuleManager<any, any, any, any, any, any, any>>();
  private eventManager: EventManager;
  private liveUpdateService?: LiveUpdateService;
  private devices = new Map<string, Device>();
  private actions = new Map<string, Action>();
  private scenes = new Map<string, Scene>();
  /** Schreibzugriffe laufen nacheinander, damit z. B. ein DELETE kein späteres INSERT überholt. */
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(databaseManager: DatabaseManager, eventManager: EventManager) {
    this.actionRepository = new ActionRepository(databaseManager);
    this.sceneRepository = new SceneRepository(databaseManager);
    this.deviceRepository = new DeviceRepository(databaseManager);
    this.eventManager = eventManager;
  }

  async initialize() {
    await this.loadDevicesFromDatabase();
    await this.loadActionsFromDatabase();
    await this.loadScenesFromDatabase();
    this.setupWorkflows();
  }

  setLiveUpdateService(service: LiveUpdateService): void {
    this.liveUpdateService = service;
  }

  private async loadDevicesFromDatabase() {
    const devices = await this.deviceRepository.findAll();
    devices.forEach(device => {
      if (device?.id) {
        this.devices.set(device.id, device);
      }
    });
  }

  private async loadActionsFromDatabase() {
    const actionDataList = await this.actionRepository.findAll();
    actionDataList.forEach(actionData => {
      if (actionData?.actionId) {
        const action = new Action(actionData);
        this.actions.set(action.actionId, action);
      }
    });
  }

  private async loadScenesFromDatabase() {
    const scenes = await this.sceneRepository.findAll();
    const existingSceneIds = new Set<string>();

    // Lade vorhandene Scenen aus der Datenbank
    scenes.forEach(scene => {
      if (scene?.id) {
        this.scenes.set(scene.id, scene);
        existingSceneIds.add(scene.id);
      }
    });

    await this.initializeStandardScenes(existingSceneIds);
  }

  private async initializeStandardScenes(existingSceneIds: Set<string>) {
    for (const def of STANDARD_SCENE_DEFINITIONS) {
      if (!existingSceneIds.has(def.id)) {
        const standardScene = new Scene({
          id: def.id,
          name: def.name,
          icon: def.icon,
          active: false,
          actionIds: [],
          showOnHome: def.showOnHome ?? true,
          isCustom: def.isCustom ?? false
        });

        this.scenes.set(def.id, standardScene);
        await this.sceneRepository.save(standardScene);
      }
    }
  }

  private enqueueWrite(description: string, context: Record<string, unknown>, write: () => Promise<unknown>) {
    this.writeQueue = this.writeQueue
      .then(write)
      .then(() => undefined)
      .catch(err => {
        logger.error({ err, ...context }, description);
      });
  }

  private persistScene(scene: Scene) {
    if (!scene.id) return;
    this.enqueueWrite("Szene konnte nicht gespeichert werden", { sceneId: scene.id }, () =>
      this.sceneRepository.save(scene)
    );
  }

  private persistAction(action: Action) {
    this.enqueueWrite("Action konnte nicht gespeichert werden", { actionId: action.actionId }, () =>
      this.actionRepository.save(action)
    );
  }

  private persistDevice(device: Device) {
    this.enqueueWrite("Device konnte nicht gespeichert werden", { deviceId: device.id }, () =>
      this.deviceRepository.save(device)
    );
  }

  private persistDeleteAction(actionId: string) {
    this.enqueueWrite("Action konnte nicht geloescht werden", { actionId }, () =>
      this.actionRepository.deleteById(actionId)
    );
  }

  private persistDeleteScene(sceneId: string) {
    this.enqueueWrite("Szene konnte nicht geloescht werden", { sceneId }, () =>
      this.sceneRepository.deleteById(sceneId)
    );
  }

  private persistDeleteDevice(deviceId: string) {
    this.enqueueWrite("Device konnte nicht geloescht werden", { deviceId }, () =>
      this.deviceRepository.deleteById(deviceId)
    );
  }

  private setupWorkflows() {
    this.actions.forEach(action => {
      if (!action.actionId) return;
      if (action.isActive === false) return;
      action.initActionRunnable(this.devices, this.scenes, this.eventManager);
    });
  }
  

  registerModuleManager(moduleManager: ModuleManager<any, any, any, any, any, any, any>): void {
    const moduleId = moduleManager.getModuleId();
    this.moduleManagers.set(moduleId, moduleManager);
    const convertPromises = this.getDevicesForModule(moduleId).map(async device => {
      const convertedDevice = await moduleManager.convertDeviceFromDatabase(device);
      if (!convertedDevice) return;
      await convertedDevice.updateValues();
      this.devices.set(device.id, convertedDevice);
    });
    Promise.all(convertPromises)
      .then(() => moduleManager.initializeDeviceControllers())
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

  shutdown() {
    this.eventManager.removeAllRunnables();
  }

  getActions(): Action[] {
    return Array.from(this.actions.values());
  }

  getAction(actionId: string): Action | null {
    return this.actions.get(actionId) ?? null;
  }

  addAction(action: Action): boolean {
    if (!action?.actionId) return false;
    if (this.actions.has(action.actionId)) {
      return this.updateAction(action);
    }
    this.persistAction(action);
    this.actions.set(action.actionId, action);
    action.initActionRunnable(this.devices, this.scenes, this.eventManager);
    this.liveUpdateService?.emit("action:updated", action);
    return true;
  }

  /** Aktualisiert per UPSERT; ein DELETE würde die Aktion per Fremdschlüssel aus allen Szenen entfernen. */
  updateAction(action: Action): boolean {
    if (!action?.actionId) return false;
    this.eventManager.removeListenerForAction(action.actionId);
    this.actions.delete(action.actionId);
    return this.addAction(action);
  }

  deleteAction(actionId: string, silent = false): boolean {
    if (!this.actions.has(actionId)) return false;
    this.actions.delete(actionId);
    this.eventManager.removeListenerForAction(actionId);
    this.persistDeleteAction(actionId);
    if (!silent) this.liveUpdateService?.emit("action:removed", { actionId });
    return true;
  }

  activateAction(actionId: string): Action | null {
    const action = this.actions.get(actionId);
    if (!action) return null;
    action.isActive = true;
    action.updatedAt = new Date().toISOString();
    this.persistAction(action);
    action.initActionRunnable(this.devices, this.scenes, this.eventManager);
    this.liveUpdateService?.emit("action:updated", action);
    return action;
  }

  deactivateAction(actionId: string): Action | null {
    const action = this.actions.get(actionId);
    if (!action) return null;
    action.isActive = false;
    action.updatedAt = new Date().toISOString();
    this.eventManager.removeListenerForAction(actionId);
    this.persistAction(action);
    this.liveUpdateService?.emit("action:updated", action);
    return action;
  }

  rejectAiSuggestion(actionId: string): boolean {
    const action = this.actions.get(actionId);
    if (!action || !action.isAiSuggested) return false;
    this.eventManager.removeListenerForAction(actionId);
    this.actions.delete(actionId);
    this.persistDeleteAction(actionId);
    this.liveUpdateService?.emit("action:removed", { actionId });
    return true;
  }

  getScenes(): Scene[] {
    return Array.from(this.scenes.values());
  }

  getScene(sceneId: string): Scene | null {
    return this.scenes.get(sceneId) ?? null;
  }

  addScene(scene: Scene): boolean {
    if (!scene?.id) return false;
    this.scenes.set(scene.id, scene);
    this.persistScene(scene);
    this.liveUpdateService?.emit("scene:updated", scene);
    return true;
  }

  updateScene(scene: Scene): boolean {
    if (!scene?.id) return false;
    this.scenes.set(scene.id, scene);
    this.persistScene(scene);
    this.liveUpdateService?.emit("scene:updated", scene);
    return true;
  }

  deleteScene(sceneId: string): boolean {
    const scene = this.scenes.get(sceneId);
    if (!scene) return false;
    this.scenes.delete(sceneId);
    this.persistDeleteScene(sceneId);
    this.liveUpdateService?.emit("scene:removed", { sceneId });
    return true;
  }

  removeRoomFromDevices(roomId: string) {
    if (!roomId) return;
    this.devices.forEach(device => {
      if (device.room === roomId) {
        device.room = undefined;
        if (device.id) {
          this.persistDevice(device);
          if (device.moduleId !== "voice-assistant") {
            this.liveUpdateService?.emit("device:updated", device);
          }
        }
      }
    });
  }

  removeDevicesForModule(moduleId: string) {
    if (!moduleId) return;
    const devicesToRemove = this.getDevicesForModule(moduleId);
    for(const device of devicesToRemove) {
      this.removeDevice(device.id);
    }
  }

  removeDevice(deviceId: string) {
    if (!deviceId) return;
    const device = this.devices.get(deviceId);
    const isVoiceAssistant = device?.moduleId === "voice-assistant";
    this.eventManager.removeListenerForDevice(deviceId);
    this.devices.delete(deviceId);
    this.persistDeleteDevice(deviceId);
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
    this.persistDevice(device);
    if (device.moduleId !== "voice-assistant") {
      this.liveUpdateService?.emit("device:updated", device);
    }
    return true;
  }

  getDevice(deviceId: string): Device | null {
    return this.devices.get(deviceId) ?? null;
  }

  getDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  getDevicesForModule(moduleId: string): Device[] {
    return Array.from(this.getDevices()).filter(device => device.moduleId === moduleId);
  }

  addDevicesForModule(moduleId: string) {
    const devices = this.getDevicesForModule(moduleId);
    for(const device of devices) {
      this.saveDevice(device);
    }
  }

}
