import { logger } from "../../logger.js";
import { Action } from "./action/Action.js";
import { Scene } from "./scene/Scene.js";
import type { ModuleManager } from "../api/modules/moduleManager.js";
import type { DatabaseManager } from "../db/database.js";
import { JsonRepository } from "../db/jsonRepository.js";
import { EventManager } from "../events/EventManager.js";
import { STANDARD_SCENE_DEFINITIONS } from "./scene/sceneDefinitions.js";
import { Device } from "../../model/devices/Device.js";


export class ActionManager {
  private actionRepository: JsonRepository<Action>;
  private sceneRepository: JsonRepository<Scene>;
  private deviceRepository: JsonRepository<Device>;
  private moduleManagers = new Map<string, ModuleManager<any, any, any, any, any, any, any>>();
  private eventManager: EventManager;
  private devices = new Map<string, Device>();
  private actions = new Map<string, Action>();
  private scenes = new Map<string, Scene>();

  constructor(databaseManager: DatabaseManager, eventManager: EventManager) {
    this.actionRepository = new JsonRepository<Action>(databaseManager, "Action");
    this.sceneRepository = new JsonRepository<Scene>(databaseManager, "Scene");
    this.deviceRepository = new JsonRepository<Device>(databaseManager, "Device");
    this.eventManager = eventManager;
    this.initialize();
  }

  initialize() {
    this.loadDevicesFromDatabase();
    this.loadActionsFromDatabase();
    this.loadScenesFromDatabase();
    this.setupWorkflows();
  }

  private loadDevicesFromDatabase() {
    const devices = this.deviceRepository.findAll();
    devices.forEach(device => {
      if (device?.id) {
        this.devices.set(device.id, device);
      }
    });
  }

  private loadActionsFromDatabase() {
    const actionDataList = this.actionRepository.findAll();
    actionDataList.forEach(actionData => {
      if (actionData?.actionId) {
        const action = new Action(actionData);
        this.actions.set(action.actionId, action);
      }
    });
  }

  private loadScenesFromDatabase() {
    const scenes = this.sceneRepository.findAll();
    const existingSceneIds = new Set<string>();

    // Lade vorhandene Scenen aus der Datenbank
    scenes.forEach(scene => {
      if (scene?.id) {
        this.scenes.set(scene.id, scene);
        existingSceneIds.add(scene.id);
      }
    });

    // Initialisiere Standard-Scenen, wenn sie nicht existieren
    this.initializeStandardScenes(existingSceneIds);
  }

  private initializeStandardScenes(existingSceneIds: Set<string>) {
    STANDARD_SCENE_DEFINITIONS.forEach((def) => {
      if (!existingSceneIds.has(def.id)) {
        // Erstelle Standard-Szene, wenn sie nicht existiert
        const standardScene = new Scene({
          id: def.id,
          name: def.name,
          icon: def.icon,
          active: false,
          actionIds: [],
          showOnHome: def.showOnHome ?? true,
          isCustom: def.isCustom ?? false
        });

        // Speichere im Memory und in der Datenbank
        this.scenes.set(def.id, standardScene);
        this.sceneRepository.save(def.id, standardScene);
      }
    });
  }

  private setupWorkflows() {
    this.actions.forEach(action => {
      if (!action.actionId) return;
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
    this.actionRepository.save(action.actionId, action);
    this.actions.set(action.actionId, action);
    action.initActionRunnable(this.devices, this.scenes, this.eventManager);
    return true;
  }

  updateAction(action: Action): boolean {
    if (!action?.actionId) return false;
    this.deleteAction(action.actionId);
    return this.addAction(action);
  }

  deleteAction(actionId: string): boolean {
    if (!this.actions.has(actionId)) return false;
    this.actions.delete(actionId);
    this.eventManager.removeListenerForAction(actionId);
    this.actionRepository.deleteById(actionId);
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
    this.sceneRepository.save(scene.id, scene);
    return true;
  }

  updateScene(scene: Scene): boolean {
    if (!scene?.id) return false;
    this.scenes.set(scene.id, scene);
    this.sceneRepository.save(scene.id, scene);
    return true;
  }

  deleteScene(sceneId: string): boolean {
    const scene = this.scenes.get(sceneId);
    if (!scene) return false;
    this.scenes.delete(sceneId);
    this.sceneRepository.deleteById(sceneId);
    return true;
  }

  removeRoomFromDevices(roomId: string) {
    if (!roomId) return;
    this.devices.forEach(device => {
      if (device.room === roomId) {
        device.room = undefined;
        if (device.id) this.deviceRepository.save(device.id, device);
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

  removeDevice(deviceId:string) {
    if (!deviceId) return;
    this.eventManager.removeListenerForDevice(deviceId);
    this.devices.delete(deviceId);
    this.deviceRepository.deleteById(deviceId);
    return true;
  }

  saveDevices(devices: Device[]): boolean {
    return devices.every(device => this.saveDevice(device));
  }

  saveDevice(device: Device): boolean {
    if (!device?.id) return false;
    this.devices.set(device.id, device);
    this.deviceRepository.save(device.id, device);
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
