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
import type { EnergyUsage, Energy } from "../../model/devices/DeviceSwitchEnergy.js";
import { DeviceType } from "../../model/devices/helper/DeviceType.js";

// Hue Module
import { HueLight } from "../api/modules/hue/hueLight.js";
import { HueLightDimmer } from "../api/modules/hue/hueLightDimmer.js";
import { HueLightDimmerTemperature } from "../api/modules/hue/hueLightDimmerTemperature.js";
import { HueLightDimmerTemperatureColor } from "../api/modules/hue/hueLightDimmerTemperatureColor.js";
import { HueMotionSensor } from "../api/modules/hue/hueMotionSensor.js";
import { HueCameraMotionSensor } from "../api/modules/hue/hueCameraMotionSensor.js";
import { HueTemperatureSensor } from "../api/modules/hue/hueTemperatureSensor.js";
import { HueLightLevelSensor } from "../api/modules/hue/hueLightLevelSensor.js";
import { HueLightLevelMotionTemperature } from "../api/modules/hue/hueLightLevelMotionTemperature.js";
import { HueSwitchDimmer } from "../api/modules/hue/hueSwitchDimmer.js";

// HEOS Module
import { HeosSpeaker } from "../api/modules/heos/heosSpeaker.js";

// Denon Module (via HEOS)
import { DenonReceiver } from "../api/modules/heos/denon/denonReceiver.js";
import { DenonSpeaker } from "../api/modules/heos/denon/denonSpeaker.js";

// LG Module
import { LGTV } from "../api/modules/lg/lgtv.js";

// Matter Module
import { MatterSwitchEnergy } from "../api/modules/matter/matterSwitchEnergy.js";

// Xiaomi Module
import { XiaomiVacuumCleaner } from "../api/modules/xiaomi/xiaomiVacuumCleaner.js";

// Scene Definitions
import { STANDARD_SCENE_DEFINITIONS } from "./sceneDefinitions.js";

export class ActionManager {
  private actionRepository: JsonRepository<Action>;
  private sceneRepository: JsonRepository<Scene>;
  private deviceRepository: JsonRepository<Device>;

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
        const convertedDevice = this.convertToDeviceClass(device);
        this.devices.set(device.id, convertedDevice);
      }
    });
  }

  private convertToDeviceClass(device: Device): Device {
    if (!device.type || !device.moduleId) {
      return device;
    }

    const deviceType = device.type as DeviceType;
    const moduleId = device.moduleId;

    try {
      let convertedDevice: Device | null = null;

      // Hue Devices
      if (moduleId === "hue") {
        switch (deviceType) {
          case DeviceType.LIGHT:
            convertedDevice = new HueLight();
            break;
          case DeviceType.LIGHT_DIMMER:
            convertedDevice = new HueLightDimmer();
            break;
          case DeviceType.LIGHT_DIMMER_TEMPERATURE:
            convertedDevice = new HueLightDimmerTemperature();
            break;
          case DeviceType.LIGHT_DIMMER_TEMPERATURE_COLOR:
            convertedDevice = new HueLightDimmerTemperatureColor();
            break;
          case DeviceType.MOTION:
            // Prüfe ob es ein Camera Motion Sensor ist (anhand des Icons)
            if (device.icon === "&#128249;") {
              convertedDevice = new HueCameraMotionSensor();
            } else {
              convertedDevice = new HueMotionSensor();
            }
            break;
          case DeviceType.TEMPERATURE:
            convertedDevice = new HueTemperatureSensor();
            break;
          case DeviceType.LIGHT_LEVEL:
            convertedDevice = new HueLightLevelSensor();
            break;
          case DeviceType.MOTION_LIGHT_LEVEL_TEMPERATURE:
            convertedDevice = new HueLightLevelMotionTemperature();
            break;
          case DeviceType.SWITCH_DIMMER:
            convertedDevice = new HueSwitchDimmer();
            break;
        }
      }

      // HEOS Devices
      if (moduleId === "heos") {
        switch (deviceType) {
          case DeviceType.SPEAKER:
            convertedDevice = new HeosSpeaker();
            break;
        }
      }

      // Denon Devices
      if (moduleId === "denon") {
        switch (deviceType) {
          case DeviceType.SPEAKER:
            convertedDevice = new DenonSpeaker();
            break;
          case DeviceType.SPEAKER_RECEIVER:
            convertedDevice = new DenonReceiver();
            break;
        }
      }

      // LG Devices
      if (moduleId === "lg") {
        switch (deviceType) {
          case DeviceType.TV:
            convertedDevice = new LGTV();
            break;
        }
      }

      // Matter Devices
      if (moduleId === "matter") {
        switch (deviceType) {
          case DeviceType.SWITCH_ENERGY:
            convertedDevice = new MatterSwitchEnergy();
            break;
        }
      }

      // Xiaomi Devices
      if (moduleId === "xiaomi") {
        switch (deviceType) {
          case DeviceType.VACUUM:
            convertedDevice = new XiaomiVacuumCleaner();
            break;
        }
      }

      // Kopiere alle Eigenschaften vom ursprünglichen Device in die neue Instanz
      if (convertedDevice) {
        Object.assign(convertedDevice, device);
        return convertedDevice;
      }
    } catch (err) {
      logger.warn({ err, deviceId: device.id, deviceType, moduleId }, "Fehler beim Konvertieren des Devices");
    }

    // Fallback: Device unverändert zurückgeben
    return device;
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
    const devices = Array.from(this.devices.values());
    // Füge Testgerät hinzu
    const testDevice = this.createTestSwitchEnergyDevice();
    devices.push(testDevice);
    return devices;
  }

  private createTestSwitchEnergyDevice(): MatterSwitchEnergy {
    const now = Date.now();
    const fiveMinutesInMs = 5 * 60 * 1000;
    const thirtyHoursInMs = 30 * 60 * 60 * 1000;
    
    // Generiere 30 Stunden Daten im 5-Minuten-Takt (360 Datenpunkte)
    const energyUsages: EnergyUsage[] = [];
    const startTime = now - thirtyHoursInMs;
    
    // Basis-Energieverbrauch pro 5 Minuten (in Watt-Stunden)
    // Simuliere einen realistischen Verbrauch mit Tag/Nacht-Zyklus
    for (let i = 0; i < 360; i++) {
      const timestamp = startTime + (i * fiveMinutesInMs);
      const hoursSinceStart = i * 5 / 60; // Stunden seit Start
      const hourOfDay = (new Date(timestamp).getHours() + hoursSinceStart) % 24;
      
      // Simuliere Tag/Nacht-Zyklus: Tagsüber höherer Verbrauch (6-22 Uhr), nachts niedriger
      const isDayTime = hourOfDay >= 6 && hourOfDay < 22;
      const baseConsumption = isDayTime ? 50 : 20; // Basis-Verbrauch in Watt
      
      // Zufällige Variation (±20%)
      const variation = (Math.random() - 0.5) * 0.4;
      const consumption = baseConsumption * (1 + variation);
      
      // Verbrauch für 5 Minuten in Watt-Stunden (Wh)
      const value = (consumption * 5) / 60; // 5 Minuten = 5/60 Stunden
      
      energyUsages.push({
        time: timestamp,
        value: Math.round(value * 100) / 100 // Auf 2 Dezimalstellen gerundet
      });
    }
    
    // Berechne die aggregierten Werte aus den historischen Daten
    const currentDate = new Date(now);
    const startOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();
    const startOfWeek = startOfDay - (currentDate.getDay() * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime();
    const startOfYear = new Date(currentDate.getFullYear(), 0, 1).getTime();
    
    // Berechne now (aktueller Verbrauch - letzter Wert)
    const nowValue = energyUsages.length > 0 ? energyUsages[energyUsages.length - 1].value : 0;
    
    // Berechne tt (heute von 0:00 bis jetzt)
    const tt = energyUsages
      .filter(e => typeof e.time === 'number' && e.time >= startOfDay && e.time <= now)
      .reduce((sum, e) => sum + e.value, 0);
    
    // Berechne ltt (gestern von 0:00 bis zur jetzigen Uhrzeit)
    const yesterdayStartOfDay = startOfDay - (24 * 60 * 60 * 1000);
    const hoursSinceMidnight = currentDate.getHours();
    const minutesSinceMidnight = currentDate.getMinutes();
    const yesterdayNow = yesterdayStartOfDay + (hoursSinceMidnight * 60 * 60 * 1000) + (minutesSinceMidnight * 60 * 1000);
    const ltt = energyUsages
      .filter(e => typeof e.time === 'number' && e.time >= yesterdayStartOfDay && e.time <= yesterdayNow)
      .reduce((sum, e) => sum + e.value, 0);
    
    // Berechne lt (gestern vollständig)
    const yesterdayEndOfDay = startOfDay;
    const lt = energyUsages
      .filter(e => typeof e.time === 'number' && e.time >= yesterdayStartOfDay && e.time < yesterdayEndOfDay)
      .reduce((sum, e) => sum + e.value, 0);
    
    // Berechne wt (diese Woche von Montag 0:00 bis jetzt)
    const wt = energyUsages
      .filter(e => typeof e.time === 'number' && e.time >= startOfWeek && e.time <= now)
      .reduce((sum, e) => sum + e.value, 0);
    
    // Berechne lwt (letzte Woche von Montag 0:00 bis zur jetzigen Uhrzeit)
    const lastWeekStart = startOfWeek - (7 * 24 * 60 * 60 * 1000);
    const timeOfDayWeek = now - startOfDay; // Zeit seit Mitternacht heute
    const lastWeekNow = lastWeekStart + timeOfDayWeek;
    const lwt = energyUsages
      .filter(e => typeof e.time === 'number' && e.time >= lastWeekStart && e.time <= lastWeekNow)
      .reduce((sum, e) => sum + e.value, 0);
    
    // Berechne lw (letzte Woche vollständig)
    const lastWeekEnd = startOfWeek;
    const lw = energyUsages
      .filter(e => typeof e.time === 'number' && e.time >= lastWeekStart && e.time < lastWeekEnd)
      .reduce((sum, e) => sum + e.value, 0);
    
    // Berechne mt (dieser Monat von 1. bis jetzt)
    const mt = energyUsages
      .filter(e => typeof e.time === 'number' && e.time >= startOfMonth && e.time <= now)
      .reduce((sum, e) => sum + e.value, 0);
    
    // Berechne lmt (letzter Monat von 1. bis zur jetzigen Uhrzeit)
    const lastMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, currentDate.getDate());
    const lastMonthStart = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1).getTime();
    const timeOfDayMonth = now - startOfDay; // Zeit seit Mitternacht heute
    const lastMonthNow = lastMonthStart + timeOfDayMonth;
    const lmt = energyUsages
      .filter(e => typeof e.time === 'number' && e.time >= lastMonthStart && e.time <= lastMonthNow)
      .reduce((sum, e) => sum + e.value, 0);
    
    // Berechne lm (letzter Monat vollständig)
    const lastMonthEnd = startOfMonth;
    const lm = energyUsages
      .filter(e => typeof e.time === 'number' && e.time >= lastMonthStart && e.time < lastMonthEnd)
      .reduce((sum, e) => sum + e.value, 0);
    
    // Berechne yt (dieses Jahr von 1.1. bis jetzt)
    const yt = energyUsages
      .filter(e => typeof e.time === 'number' && e.time >= startOfYear && e.time <= now)
      .reduce((sum, e) => sum + e.value, 0);
    
    // Berechne ylt (letztes Jahr von 1.1. bis zur jetzigen Uhrzeit)
    const lastYearStart = new Date(currentDate.getFullYear() - 1, 0, 1).getTime();
    const timeOfDayYear = now - startOfDay; // Zeit seit Mitternacht heute
    const dayOfYear = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
    const lastYearNow = lastYearStart + (dayOfYear * 24 * 60 * 60 * 1000) + timeOfDayYear;
    const ylt = energyUsages
      .filter(e => typeof e.time === 'number' && e.time >= lastYearStart && e.time <= lastYearNow)
      .reduce((sum, e) => sum + e.value, 0);
    
    // Berechne yl (letztes Jahr vollständig)
    const lastYearEnd = startOfYear;
    const yl = energyUsages
      .filter(e => typeof e.time === 'number' && e.time >= lastYearStart && e.time < lastYearEnd)
      .reduce((sum, e) => sum + e.value, 0);
    
    const energyUsage: Energy = {
      now: Math.round(nowValue * 100) / 100,
      tt: Math.round(tt * 100) / 100,
      ltt: Math.round(ltt * 100) / 100,
      lt: Math.round(lt * 100) / 100,
      wt: Math.round(wt * 100) / 100,
      lwt: Math.round(lwt * 100) / 100,
      lw: Math.round(lw * 100) / 100,
      mt: Math.round(mt * 100) / 100,
      lmt: Math.round(lmt * 100) / 100,
      lm: Math.round(lm * 100) / 100,
      yt: Math.round(yt * 100) / 100,
      ylt: Math.round(ylt * 100) / 100,
      yl: Math.round(yl * 100) / 100
    };
    
    const device = new MatterSwitchEnergy(
      "Test Smart Plug Energy",
      "test-switch-energy-001",
      "test-node-001",
      ["button-1"]
    );
    
    device.setEnergyUsage(energyUsage, false);
    device.setEnergyUsages(energyUsages);
    device.addButton("button-1");
    const button = device.buttons["button-1"];
    if (button) {
      button.setOn(true); // Gerät ist aktiv
    }
    
    return device;
  }
}

