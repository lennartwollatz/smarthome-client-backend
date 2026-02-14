import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";

export abstract class DeviceVacuumCleaner extends Device {
  static TriggerFunctionName = {
    CLEANING_STARTED: "cleaningStarted",
    CLEANING_STOPPED: "cleaningStopped",
    CLEANING_PAUSED: "cleaningPaused",
    CLEANING_RESUMED: "cleaningResumed",
    CLEANING_DONE: "cleaningDone",
    ROOM_CLEANED: "roomCleaned(string)",
    ROOM_ENTERED: "inRoom(string)",
    ROOM_LEFT: "roomLeft(string)",
    ZONE_CLEANED: "zoneCleaned(string)",
    ZONE_ENTERED: "zoneEntered(string)",
    ZONE_LEFT: "zoneLeft(string)",
    WATER_BOX_FULL: "waterBoxFull",
    WATER_BOX_EMPTY: "waterBoxEmpty",
    WATER_BOX_LEVEL_GREATER: "waterBoxLevelGreater(int)",
    WATER_BOX_LEVEL_LESS: "waterBoxLevelLess(int)",
    WATER_BOX_LEVEL_EQUALS: "waterBoxLevelEquals(int)",
    DIRTY_WATER_BOX_FULL: "dirtyWaterBoxFull",
    DIRTY_WATER_BOX_EMPTY: "dirtyWaterBoxEmpty",
    DIRTY_WATER_BOX_LEVEL_GREATER: "dirtyWaterBoxLevelGreater(int)",
    DIRTY_WATER_BOX_LEVEL_LESS: "dirtyWaterBoxLevelLess(int)",
    DIRTY_WATER_BOX_LEVEL_EQUALS: "dirtyWaterBoxLevelEquals(int)",
    FAN_SPEED_CHANGED: "fanSpeedChanged",
    FAN_SPEED_GREATER: "fanSpeedGreater(int)",
    FAN_SPEED_LESS: "fanSpeedLess(int)",
    FAN_SPEED_EQUALS: "fanSpeedEquals(int)",
    DOCKED: "docked",
    UNDOCKED: "undocked",
    BATTERY_GREATER: "batteryGreater(int)",
    BATTERY_LESS: "batteryLess(int)",
    BATTERY_EQUALS: "batteryEquals(int)",
    MODE_CHANGED: "modeChanged",
    MODE_EQUALS: "modeEquals(string)"
  } as const;

  static ActionFunctionName = {
    START_CLEANING: "startCleaning",
    STOP_CLEANING: "stopCleaning",
    PAUSE_CLEANING: "pauseCleaning",
    RESUME_CLEANING: "resumeCleaning",
    DOCK: "dock",
    SET_MODE: "setMode(string)",
    CLEAN_ROOM: "cleanRoom(string)",
    CLEAN_ZONE: "cleanZone(string)",
    CHANGE_FAN_SPEED: "changeFanSpeed(int)",
    CHANGE_MODE: "changeMode(string)"
  } as const;

  static BoolFunctionName = {
    CLEANING: "cleaning",
    DOCKED: "docked",
    UNDOCKED: "undocked",
    FAN_SPEED_GREATER: "fanSpeedGreater(int)",
    FAN_SPEED_LESS: "fanSpeedLess(int)",
    FAN_SPEED_EQUALS: "fanSpeedEquals(int)",
    WATER_BOX_FULL: "waterBoxFull",
    WATER_BOX_EMPTY: "waterBoxEmpty",
    WATER_BOX_LEVEL_GREATER: "waterBoxLevelGreater(int)",
    WATER_BOX_LEVEL_LESS: "waterBoxLevelLess(int)",
    WATER_BOX_LEVEL_EQUALS: "waterBoxLevelEquals(int)",
    DIRTY_WATER_BOX_FULL: "dirtyWaterBoxFull",
    DIRTY_WATER_BOX_EMPTY: "dirtyWaterBoxEmpty",
    DIRTY_WATER_BOX_LEVEL_GREATER: "dirtyWaterBoxLevelGreater(int)",
    DIRTY_WATER_BOX_LEVEL_LESS: "dirtyWaterBoxLevelLess(int)",
    DIRTY_WATER_BOX_LEVEL_EQUALS: "dirtyWaterBoxLevelEquals(int)",
    BATTERY_GREATER: "batteryGreater(int)",
    BATTERY_LESS: "batteryLess(int)",
    BATTERY_EQUALS: "batteryEquals(int)",
    MODE_EQUALS: "modeEquals(string)",
    IN_ROOM: "inRoom(string)",
    IN_ZONE: "inZone(string)",
    OUT_ROOM: "outRoom(string)",
    OUT_ZONE: "outZone(string)"
  } as const;

  power?: boolean;
  cleaningState?: boolean;
  dockedState?: boolean;
  battery?: number;
  fanSpeed?: number;
  waterBoxLevel?: number;
  dirtyWaterBoxLevel?: number;
  currentRoom?: string;
  currentZone?: string;
  waterBoxFullState?: boolean;
  dirtyWaterBoxFullState?: boolean;
  mode?: string;
  error?: string;

  constructor(init?: Partial<DeviceVacuumCleaner>) {
    super();
    Object.assign(this, init);
    this.type = DeviceType.VACUUM;
    this.icon = "&#129529;";
    this.typeLabel = "deviceType.vacuum";
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  abstract updateValues(): Promise<void>;

  protected override initializeFunctionsBool() {
    this.functionsBool = [
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.CLEANING, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.DOCKED, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.UNDOCKED, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.FAN_SPEED_GREATER, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.FAN_SPEED_LESS, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.FAN_SPEED_EQUALS, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.WATER_BOX_FULL, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.WATER_BOX_EMPTY, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.WATER_BOX_LEVEL_GREATER, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.WATER_BOX_LEVEL_LESS, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.WATER_BOX_LEVEL_EQUALS, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.DIRTY_WATER_BOX_FULL, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.DIRTY_WATER_BOX_EMPTY, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.DIRTY_WATER_BOX_LEVEL_GREATER, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.DIRTY_WATER_BOX_LEVEL_LESS, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.DIRTY_WATER_BOX_LEVEL_EQUALS, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.BATTERY_GREATER, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.BATTERY_LESS, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.BATTERY_EQUALS, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.MODE_EQUALS, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.IN_ROOM, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.IN_ZONE, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.OUT_ROOM, 'bool'),
      DeviceFunction.fromString(DeviceVacuumCleaner.BoolFunctionName.OUT_ZONE, 'bool')
    ];
  }

  protected override initializeFunctionsAction() {
    this.functionsAction = [
      DeviceFunction.fromString(DeviceVacuumCleaner.ActionFunctionName.START_CLEANING, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.ActionFunctionName.STOP_CLEANING, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.ActionFunctionName.PAUSE_CLEANING, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.ActionFunctionName.RESUME_CLEANING, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.ActionFunctionName.DOCK, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.ActionFunctionName.SET_MODE, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.ActionFunctionName.CLEAN_ROOM, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.ActionFunctionName.CLEAN_ZONE, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.ActionFunctionName.CHANGE_FAN_SPEED, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.ActionFunctionName.CHANGE_MODE, 'void')
    ];
  }

  protected override initializeFunctionsTrigger() {
    this.functionsTrigger = [
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.CLEANING_STARTED, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.CLEANING_STOPPED, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.CLEANING_PAUSED, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.CLEANING_RESUMED, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.CLEANING_DONE, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.ROOM_CLEANED, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.ROOM_ENTERED, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.ROOM_LEFT, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.ZONE_CLEANED, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.ZONE_ENTERED, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.ZONE_LEFT, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.WATER_BOX_FULL, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.WATER_BOX_EMPTY, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.WATER_BOX_LEVEL_GREATER, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.WATER_BOX_LEVEL_LESS, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.WATER_BOX_LEVEL_EQUALS, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.DIRTY_WATER_BOX_FULL, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.DIRTY_WATER_BOX_EMPTY, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.DIRTY_WATER_BOX_LEVEL_GREATER, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.DIRTY_WATER_BOX_LEVEL_LESS, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.DIRTY_WATER_BOX_LEVEL_EQUALS, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.FAN_SPEED_CHANGED, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.FAN_SPEED_GREATER, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.FAN_SPEED_LESS, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.FAN_SPEED_EQUALS, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.DOCKED, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.UNDOCKED, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.BATTERY_GREATER, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.BATTERY_LESS, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.BATTERY_EQUALS, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.MODE_CHANGED, 'void'),
      DeviceFunction.fromString(DeviceVacuumCleaner.TriggerFunctionName.MODE_EQUALS, 'void')
    ];
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    const isValid = Object.values(DeviceVacuumCleaner.TriggerFunctionName).includes(
      triggerName as (typeof DeviceVacuumCleaner.TriggerFunctionName)[keyof typeof DeviceVacuumCleaner.TriggerFunctionName]
    );
    if (!isValid) return;
    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.CLEANING_STARTED && this.cleaning()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.CLEANING_STOPPED && !this.cleaning()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.CLEANING_PAUSED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.CLEANING_RESUMED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.CLEANING_DONE) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.ROOM_CLEANED) {
      listeners
        .filter(pair => {
          const roomId = pair.getParams()?.getParam1AsString();
          return roomId != null && this.inRoom(roomId);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.ROOM_ENTERED) {
      listeners
        .filter(pair => {
          const roomId = pair.getParams()?.getParam1AsString();
          return roomId != null && this.inRoom(roomId);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.ROOM_LEFT) {
      listeners
        .filter(pair => {
          const roomId = pair.getParams()?.getParam1AsString();
          return roomId != null && this.outRoom(roomId);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.ZONE_CLEANED) {
      listeners
        .filter(pair => {
          const zoneId = pair.getParams()?.getParam1AsString();
          return zoneId != null && this.inZone(zoneId);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.ZONE_ENTERED) {
      listeners
        .filter(pair => {
          const zoneId = pair.getParams()?.getParam1AsString();
          return zoneId != null && this.inZone(zoneId);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.ZONE_LEFT) {
      listeners
        .filter(pair => {
          const zoneId = pair.getParams()?.getParam1AsString();
          return zoneId != null && this.outZone(zoneId);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.WATER_BOX_FULL && this.waterBoxFull()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.WATER_BOX_EMPTY && this.waterBoxEmpty()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.WATER_BOX_LEVEL_GREATER) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.waterBoxLevelGreater(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.WATER_BOX_LEVEL_LESS) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.waterBoxLevelLess(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.WATER_BOX_LEVEL_EQUALS) {
      listeners
        .filter(pair => {
          const target = pair.getParams()?.getParam1AsInt();
          return target != null && this.waterBoxLevelEquals(target);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.DIRTY_WATER_BOX_FULL && this.dirtyWaterBoxFull()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.DIRTY_WATER_BOX_EMPTY && this.dirtyWaterBoxEmpty()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.DIRTY_WATER_BOX_LEVEL_GREATER) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.dirtyWaterBoxLevelGreater(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.DIRTY_WATER_BOX_LEVEL_LESS) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.dirtyWaterBoxLevelLess(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.DIRTY_WATER_BOX_LEVEL_EQUALS) {
      listeners
        .filter(pair => {
          const target = pair.getParams()?.getParam1AsInt();
          return target != null && this.dirtyWaterBoxLevelEquals(target);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.FAN_SPEED_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.FAN_SPEED_GREATER) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.fanSpeedGreater(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.FAN_SPEED_LESS) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.fanSpeedLess(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.FAN_SPEED_EQUALS) {
      listeners
        .filter(pair => {
          const target = pair.getParams()?.getParam1AsInt();
          return target != null && this.fanSpeedEquals(target);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.DOCKED && this.docked()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.UNDOCKED && !this.docked()) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.BATTERY_GREATER) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.batteryGreater(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.BATTERY_LESS) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.batteryLess(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.BATTERY_EQUALS) {
      listeners
        .filter(pair => {
          const target = pair.getParams()?.getParam1AsInt();
          return target != null && this.batteryEquals(target);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.MODE_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceVacuumCleaner.TriggerFunctionName.MODE_EQUALS) {
      listeners
        .filter(pair => {
          const targetMode = pair.getParams()?.getParam1AsString();
          return targetMode != null && this.modeEquals(targetMode);
        })
        .forEach(pair => pair.run());
    }
  }

  setPower(power: boolean, execute: boolean) {
    this.power = power;
    if (execute) {
      this.executeSetPower(power);
    }
  }

  protected abstract executeSetPower(power: boolean): void;

  startCleaning(execute: boolean) {
    this.cleaningState = true;
    this.power = true;
    if (execute) {
      this.executeStartCleaning();
    }
  }

  protected abstract executeStartCleaning(): void;

  stopCleaning(execute: boolean) {
    this.cleaningState = false;
    if (execute) {
      this.executeStopCleaning();
    }
  }

  protected abstract executeStopCleaning(): void;

  pauseCleaning(execute: boolean) {
    this.cleaningState = false;
    if (execute) {
      this.executePauseCleaning();
    }
  }

  protected abstract executePauseCleaning(): void;

  resumeCleaning(execute: boolean) {
    this.cleaningState = true;
    this.dockedState = false;
    if (execute) {
      this.executeResumeCleaning();
    }
  }

  protected abstract executeResumeCleaning(): void;

  dock(execute: boolean) {
    if (execute) {
      this.executeDock();
    }
  }

  protected abstract executeDock(): void;

  setMode(mode: string, execute: boolean) {
    this.mode = mode;
    this.power = true;
    if (execute) {
      this.executeSetMode(mode);
    }
  }

  protected abstract executeSetMode(mode: string): void;

  cleanRoom(roomId: string, execute: boolean) {
    this.power = true;
    if (execute) {
      this.executeCleanRoom(roomId);
    }
  }

  protected abstract executeCleanRoom(roomId: string): void;

  cleanZone(zoneId: string, execute: boolean) {
    this.power = true;
    if (execute) {
      this.executeCleanZone(zoneId);
    }
  }

  protected abstract executeCleanZone(zoneId: string): void;

  changeFanSpeed(fanSpeed: number, execute: boolean) {
    this.fanSpeed = fanSpeed;
    if (execute) {
      this.executeChangeFanSpeed(fanSpeed);
    }
  }

  protected abstract executeChangeFanSpeed(fanSpeed: number): void;

  changeMode(mode: string, execute: boolean) {
    this.mode = mode;
    this.power = true;
    if (execute) {
      this.executeChangeMode(mode);
    }
  }

  protected abstract executeChangeMode(mode: string): void;

  setBattery(battery: number) {
    this.battery = battery;
  }

  setFanSpeed(fanSpeed: number) {
    this.fanSpeed = fanSpeed;
  }

  setWaterBoxLevel(waterBoxLevel: number) {
    this.waterBoxLevel = waterBoxLevel;
  }

  setDirtyWaterBoxLevel(dirtyWaterBoxLevel: number) {
    this.dirtyWaterBoxLevel = dirtyWaterBoxLevel;
  }

  setCurrentRoom(currentRoom: string) {
    this.currentRoom = currentRoom;
  }

  setCurrentZone(currentZone: string) {
    this.currentZone = currentZone;
  }

  setWaterBoxFull(waterBoxFull: boolean) {
    this.waterBoxFullState = waterBoxFull;
  }

  setDirtyWaterBoxFull(dirtyWaterBoxFull: boolean) {
    this.dirtyWaterBoxFullState = dirtyWaterBoxFull;
  }

  setDocked(docked: boolean) {
    this.dockedState = docked;
  }

  setCleaning(cleaning: boolean) {
    this.cleaningState = cleaning;
  }

  setError(error: string) {
    this.error = error;
  }

  clearError(execute: boolean) {
    this.error = undefined;
    if (execute) {
      this.executeClearError();
    }
  }

  protected abstract executeClearError(): void;

  powerOn() {
    return this.power === true;
  }

  powerOff() {
    return this.power === false;
  }

  cleaning() {
    return this.cleaningState === true;
  }

  docked() {
    return this.dockedState === true;
  }

  batteryGreater(threshold: number) {
    return this.battery != null && this.battery > threshold;
  }

  batteryLess(threshold: number) {
    return this.battery != null && this.battery < threshold;
  }

  batteryEquals(value: number) {
    return this.battery != null && this.battery === value;
  }

  fanSpeedGreater(threshold: number) {
    return this.fanSpeed != null && this.fanSpeed > threshold;
  }

  fanSpeedLess(threshold: number) {
    return this.fanSpeed != null && this.fanSpeed < threshold;
  }

  fanSpeedEquals(value: number) {
    return this.fanSpeed != null && this.fanSpeed === value;
  }

  waterBoxFull() {
    if (this.waterBoxFullState != null) {
      return this.waterBoxFullState === true;
    }
    return this.waterBoxLevel != null && this.waterBoxLevel >= 100;
  }

  waterBoxEmpty() {
    if (this.waterBoxFullState != null) {
      return this.waterBoxFullState === false;
    }
    return this.waterBoxLevel != null && this.waterBoxLevel <= 0;
  }

  waterBoxLevelGreater(threshold: number) {
    return this.waterBoxLevel != null && this.waterBoxLevel > threshold;
  }

  waterBoxLevelLess(threshold: number) {
    return this.waterBoxLevel != null && this.waterBoxLevel < threshold;
  }

  waterBoxLevelEquals(value: number) {
    return this.waterBoxLevel != null && this.waterBoxLevel === value;
  }

  dirtyWaterBoxFull() {
    if (this.dirtyWaterBoxFullState != null) {
      return this.dirtyWaterBoxFullState === true;
    }
    return this.dirtyWaterBoxLevel != null && this.dirtyWaterBoxLevel >= 100;
  }

  dirtyWaterBoxEmpty() {
    if (this.dirtyWaterBoxFullState != null) {
      return this.dirtyWaterBoxFullState === false;
    }
    return this.dirtyWaterBoxLevel != null && this.dirtyWaterBoxLevel <= 0;
  }

  dirtyWaterBoxLevelGreater(threshold: number) {
    return this.dirtyWaterBoxLevel != null && this.dirtyWaterBoxLevel > threshold;
  }

  dirtyWaterBoxLevelLess(threshold: number) {
    return this.dirtyWaterBoxLevel != null && this.dirtyWaterBoxLevel < threshold;
  }

  dirtyWaterBoxLevelEquals(value: number) {
    return this.dirtyWaterBoxLevel != null && this.dirtyWaterBoxLevel === value;
  }

  modeEquals(targetMode: string) {
    return targetMode != null && targetMode === this.mode;
  }

  inRoom(roomId: string) {
    return roomId != null && roomId === this.currentRoom;
  }

  inZone(zoneId: string) {
    return zoneId != null && zoneId === this.currentZone;
  }

  outRoom(roomId: string) {
    return roomId != null && roomId !== this.currentRoom;
  }

  outZone(zoneId: string) {
    return zoneId != null && zoneId !== this.currentZone;
  }

  errorEquals(targetError: string) {
    return targetError != null && targetError === this.error;
  }
}
