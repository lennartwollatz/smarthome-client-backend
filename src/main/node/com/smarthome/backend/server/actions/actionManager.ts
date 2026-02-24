import type { DatabaseManager } from "../db/database.js";
import { JsonRepository } from "../db/jsonRepository.js";
import { ActionRunnable } from "./actionRunnable.js";
import { TimeTriggerRunnable } from "./timeTriggerRunnable.js";
import { logger } from "../../logger.js";
import type {
  Action,
  DeviceTrigger,
  Device
} from "../../model/index.js";
import { Scene } from "../../model/index.js";
import { STANDARD_SCENE_DEFINITIONS } from "./sceneDefinitions.js";
import type { ModuleManager } from "../api/modules/moduleManager.js";

export class ActionManager {
 
  private actionRepository: JsonRepository<Action>;
  private sceneRepository: JsonRepository<Scene>;
  private deviceRepository: JsonRepository<Device>;
  private moduleManagers = new Map<string, ModuleManager<any, any, any, any, any, any, any>>();

  private devices = new Map<string, Device>();
  private actions = new Map<string, Action>();
  private scenes = new Map<string, Scene>();
  private actionRunnables = new Map<string, ActionRunnable>();
  private timeTriggerRunnables = new Map<string, TimeTriggerRunnable>();

  constructor(databaseManager: DatabaseManager) {
    this.actionRepository = new JsonRepository<Action>(databaseManager, "Action");
    this.sceneRepository = new JsonRepository<Scene>(databaseManager, "Scene");
    this.deviceRepository = new JsonRepository<Device>(databaseManager, "Device");
    this.initialize();
  }

  registerModuleManager(moduleManager: ModuleManager<any, any, any, any, any, any, any>): void {
    const moduleId = moduleManager.getModuleId();
    this.moduleManagers.set(moduleId, moduleManager);
    this.getDevicesForModule(moduleId).forEach(device => {
      const convertedDevice = moduleManager.convertDeviceFromDatabase(device);
      if (convertedDevice) {
        this.devices.set(device.id, convertedDevice);
      }
    });
    moduleManager.initializeDeviceControllers().catch(err => {
      logger.error({ err, moduleId }, "Fehler beim Initialisieren der Device-Controller");
    });
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
    const actions = this.actionRepository.findAll();
    actions.forEach(action => {
      if (action?.actionId) this.actions.set(action.actionId, action);
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
      const runnable = this.buildActionRunnable(action);
      this.actionRunnables.set(action.actionId, runnable);
    });
    this.addRunnablesForScenes();
    this.addRunnablesForActions();
  }

  private buildActionRunnable(action: Action) {
    const runnable = new ActionRunnable(() => {
      logger.debug({ actionId: action.actionId }, "Action ausgeführt");
    });
    return runnable;
  }

  private addRunnablesForScenes() {
    this.scenes.forEach(scene => this.addRunnablesForScene(scene));
  }

  private addRunnablesForScene(scene: Scene) {
    const actionIds = scene.actionIds ?? [];
    actionIds.forEach(actionId => {
      const runnable = this.actionRunnables.get(actionId);
      if (runnable && typeof (scene as any).addListener === "function") {
        (scene as any).addListener(actionId, () => runnable.run());
      }
    });
  }

  private addRunnablesForActions() {
    this.actions.forEach(action => {
      switch (action.triggerType) {
        case "manual":
          this.addRunnablesForActionsManual(action);
          break;
        case "device":
          this.addRunnableForActionsDevice(action);
          break;
        case "time":
          this.addRunnableForActionsTime(action);
          break;
      }
    });
  }

  private addRunnablesForActionsManual(action: Action) {
    this.scenes.forEach(scene => {
      const runnable = this.actionRunnables.get(action.actionId ?? "");
      if (runnable && typeof (scene as any).addListener === "function") {
        (scene as any).addListener(action.actionId, () => runnable.run());
      }
    });
  }

  private addRunnableForActionsDevice(action: Action) {
    const triggerNode = (action.workflow as any)?.triggerNode;
    const deviceTrigger = triggerNode?.triggerConfig?.deviceTrigger;
    if (!deviceTrigger?.triggerDeviceId) return;
    const device = this.devices.get(deviceTrigger.triggerDeviceId);
    if (!device) return;
    this.addTriggers(deviceTrigger, action, device);
  }

  private addTriggers(deviceTrigger: DeviceTrigger, action: Action, device: Device) {
    const triggerEvent = deviceTrigger.triggerEvent;
    const triggerValues = deviceTrigger.triggerValues ?? [];
    if (!triggerEvent) return;
    const runnable = this.actionRunnables.get(action.actionId ?? "");
    if (!runnable) return;
    const addListener = (device as any).addListener;
    if (typeof addListener !== "function") return;

    if (triggerValues.length === 0) {
      addListener({ actionId: action.actionId, triggerEvent }, () => runnable.run());
    } else if (triggerValues.length === 1) {
      addListener({ actionId: action.actionId, triggerEvent, value1: triggerValues[0] }, () => runnable.run());
    } else if (triggerValues.length === 2) {
      addListener(
        { actionId: action.actionId, triggerEvent, value1: triggerValues[0], value2: triggerValues[1] },
        () => runnable.run()
      );
    }
  }

  private addRunnableForActionsTime(action: Action) {
    const timeTrigger = (action.workflow as any)?.triggerNode?.triggerConfig?.timeTrigger;
    if (!timeTrigger || !action.actionId) return;
    const runnable = this.actionRunnables.get(action.actionId);
    if (!runnable) return;
    const timeRunnable = new TimeTriggerRunnable(timeTrigger, () => runnable.run());
    this.timeTriggerRunnables.set(action.actionId, timeRunnable);
    timeRunnable.start();
  }

  addAction(action: Action): boolean {
    if (!action?.actionId) return false;
    if (this.actions.has(action.actionId)) {
      return this.updateAction(action);
    }
    this.actionRepository.save(action.actionId, action);
    this.actions.set(action.actionId, action);
    this.actionRunnables.set(action.actionId, this.buildActionRunnable(action));
    this.setupTriggersForAction(action);
    return true;
  }

  updateAction(action: Action): boolean {
    if (!action?.actionId) return false;
    this.deleteAction(action.actionId);
    return this.addAction(action);
  }

  deleteAction(actionId: string): boolean {
    if (!this.actions.has(actionId)) return false;
    this.removeTriggersForAction(actionId);
    this.actions.delete(actionId);
    this.actionRunnables.delete(actionId);
    this.actionRepository.deleteById(actionId);
    return true;
  }

  private setupTriggersForAction(action: Action) {
    switch (action.triggerType) {
      case "manual":
        this.addRunnablesForActionsManual(action);
        break;
      case "device":
        this.addRunnableForActionsDevice(action);
        break;
      case "time":
        this.addRunnableForActionsTime(action);
        break;
    }
  }

  private removeTriggersForAction(actionId: string) {
    const action = this.actions.get(actionId);
    if (!action) return;
    switch (action.triggerType) {
      case "device":
        this.removeDeviceTriggerForAction(action);
        break;
      case "time":
        this.removeTimeTriggerForAction(actionId);
        break;
      case "manual":
        this.removeSceneTriggerForAction(actionId);
        break;
    }
  }

  private removeDeviceTriggerForAction(action: Action) {
    const deviceTrigger = (action.workflow as any)?.triggerNode?.triggerConfig?.deviceTrigger;
    if (!deviceTrigger?.triggerDeviceId || !deviceTrigger.triggerEvent) return;
    const device = this.devices.get(deviceTrigger.triggerDeviceId);
    if (device && typeof (device as any).removeListener === "function") {
      (device as any).removeListener(action.actionId, deviceTrigger.triggerEvent);
    }
  }

  private removeTimeTriggerForAction(actionId: string) {
    const runnable = this.timeTriggerRunnables.get(actionId);
    runnable?.stop();
    this.timeTriggerRunnables.delete(actionId);
  }

  private removeSceneTriggerForAction(actionId: string) {
    this.scenes.forEach(scene => {
      if (typeof (scene as any).removeListener === "function") {
        (scene as any).removeListener(actionId);
      }
    });
  }

  shutdown() {
    this.timeTriggerRunnables.forEach(runnable => runnable.stop());
    this.timeTriggerRunnables.clear();
  }

  getAction(actionId: string): Action | null {
    return this.actions.get(actionId) ?? null;
  }

  getActions(): Action[] {
    return Array.from(this.actions.values());
  }

  getScenes(): Scene[] {
    return Array.from(this.scenes.values());
  }

  getScene(sceneId: string): Scene | null {
    return this.scenes.get(sceneId) ?? null;
  }

  addScene(scene: Scene): boolean {
    if (!scene?.id) return false;
    this.addRunnablesForScene(scene);
    this.scenes.set(scene.id, scene);
    this.sceneRepository.save(scene.id, scene);
    return true;
  }

  saveScene(scene: Scene): boolean {
    if (!scene?.id) return false;
    this.scenes.set(scene.id, scene);
    this.sceneRepository.save(scene.id, scene);
    return true;
  }

  updateScene(scene: Scene): boolean {
    if (!scene?.id) return false;
    if (typeof (scene as any).removeAllListeners === "function") {
      (scene as any).removeAllListeners();
    }
    this.addRunnablesForScene(scene);
    this.scenes.set(scene.id, scene);
    this.sceneRepository.save(scene.id, scene);
    return true;
  }

  deleteScene(sceneId: string): boolean {
    const scene = this.scenes.get(sceneId);
    if (!scene) return false;
    if (typeof (scene as any).removeAllListeners === "function") {
      (scene as any).removeAllListeners();
    }
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

  removeDeviceForModule(moduleId: string) {
    if (!moduleId) return;
    this.devices.forEach(device => {
      if (device.moduleId === moduleId && typeof (device as any).removeAllListeners === "function") {
        (device as any).removeAllListeners();
      }
    });
  }

  addDevicesForModule(moduleId: string) {
    if (!moduleId) return;
    this.actions.forEach(action => {
      const deviceTrigger = (action.workflow as any)?.triggerNode?.triggerConfig?.deviceTrigger;
      if (!deviceTrigger?.triggerDeviceId) return;
      const device = this.devices.get(deviceTrigger.triggerDeviceId);
      if (device?.moduleId === moduleId) {
        this.addTriggers(deviceTrigger, action, device);
      }
    });
  }

  saveDevice(device: Device): boolean {
    if (!device?.id) return false;
    this.devices.set(device.id, device);
    this.deviceRepository.save(device.id, device);
    return true;
  }

  saveDevices(devices: Device[]): boolean {
    return devices.every(device => this.saveDevice(device));
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

}

