import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";

export abstract class DeviceLightLevelMotionTemperature extends Device {
  // Motion Trigger Function Names
  static MotionTriggerFunctionName = {
    SENSIBILITY_CHANGED: "sensibilityChanged",
    MOTION_DETECTED: "motionDetected",
    NO_MOTION_DETECTED: "noMotionDetected",
    MOTION_DETECTED_SINCE: "motionDetectedSince(int)",
    NO_MOTION_DETECTED_SINCE: "noMotionDetectedSince(int)"
  } as const;

  // Motion Action Function Names
  static MotionActionFunctionName = {
    SET_SENSIBILITY: "setSensibility(int)"
  } as const;

  // Motion Bool Function Names
  static MotionBoolFunctionName = {
    MOTION: "motion",
    NO_MOTION: "noMotion",
    MOTION_SINCE: "motionSince(int)",
    NO_MOTION_SINCE: "noMotionSince(int)"
  } as const;

  // Light Level Trigger Function Names
  static LightLevelTriggerFunctionName = {
    LEVEL_CHANGED: "levelChanged",
    LEVEL_GREATER: "levelGreater(int)",
    LEVEL_LESS: "levelLess(int)",
    LEVEL_REACHES: "levelReaches(int)",
    DARK: "dark",
    BRIGHT: "bright"
  } as const;

  // Light Level Bool Function Names
  static LightLevelBoolFunctionName = {
    DARK: "dark",
    BRIGHT: "bright",
    LEVEL_GREATER: "levelGreater(int)",
    LEVEL_LESS: "levelLess(int)",
    LEVEL_EQUALS: "levelEquals(int)"
  } as const;

  // Temperature Trigger Function Names
  static TemperatureTriggerFunctionName = {
    TEMPERATURE_CHANGED: "temperatureChanged",
    TEMPERATURE_GREATER: "temperatureGreater(int)",
    TEMPERATURE_LESS: "temperatureLess(int)",
    TEMPERATURE_EQUALS: "temperatureEquals(int)"
  } as const;

  // Temperature Bool Function Names
  static TemperatureBoolFunctionName = {
    TEMPERATURE_GREATER: "temperatureGreater(int)",
    TEMPERATURE_LESS: "temperatureLess(int)",
    TEMPERATURE_EQUALS: "temperatureEquals(int)"
  } as const;

  // Properties - Feldnamen für Frontend-Kompatibilität
  sensitivity?: number;
  motion?: boolean;
  motion_last_detect?: string;
  lightLevel?: number;
  temperature?: number;
  private periodicCheckTasks: Map<string, NodeJS.Timeout> = new Map();

  constructor(init?: Partial<DeviceLightLevelMotionTemperature>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.MOTION_LIGHT_LEVEL_TEMPERATURE;
    this.icon = "&#128064;&#9728;&#127777;";
    this.typeLabel = "deviceType.light-level-motion-temperature";
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  abstract updateValues(): Promise<void>;

  override removeListener(key?: string, name?: string) {
    if (key) {
      const task = this.periodicCheckTasks.get(key);
      if (task) {
        clearTimeout(task);
        this.periodicCheckTasks.delete(key);
      }
    }
    super.removeListener(key, name);
  }

  protected override initializeFunctionsBool() {
    this.functionsBool = [
      // Motion functions
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.MotionBoolFunctionName.MOTION, 'bool'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.MotionBoolFunctionName.NO_MOTION, 'bool'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.MotionBoolFunctionName.MOTION_SINCE, 'bool'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.MotionBoolFunctionName.NO_MOTION_SINCE, 'bool'),
      // Light Level functions
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.LightLevelBoolFunctionName.DARK, 'bool'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.LightLevelBoolFunctionName.BRIGHT, 'bool'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.LightLevelBoolFunctionName.LEVEL_GREATER, 'bool'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.LightLevelBoolFunctionName.LEVEL_LESS, 'bool'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.LightLevelBoolFunctionName.LEVEL_EQUALS, 'bool'),
      // Temperature functions
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.TemperatureBoolFunctionName.TEMPERATURE_GREATER, 'bool'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.TemperatureBoolFunctionName.TEMPERATURE_LESS, 'bool'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.TemperatureBoolFunctionName.TEMPERATURE_EQUALS, 'bool')
    ];
  }

  protected override initializeFunctionsAction() {
    this.functionsAction = [
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.MotionActionFunctionName.SET_SENSIBILITY, 'void')
    ];
  }

  protected override initializeFunctionsTrigger() {
    this.functionsTrigger = [
      // Motion triggers
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.SENSIBILITY_CHANGED, 'void'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.MOTION_DETECTED, 'void'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.NO_MOTION_DETECTED, 'void'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.MOTION_DETECTED_SINCE, 'void'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.NO_MOTION_DETECTED_SINCE, 'void'),
      // Light Level triggers
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName.LEVEL_CHANGED, 'void'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName.LEVEL_GREATER, 'void'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName.LEVEL_LESS, 'void'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName.DARK, 'void'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName.BRIGHT, 'void'),
      // Temperature triggers
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.TemperatureTriggerFunctionName.TEMPERATURE_CHANGED, 'void'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.TemperatureTriggerFunctionName.TEMPERATURE_GREATER, 'void'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.TemperatureTriggerFunctionName.TEMPERATURE_LESS, 'void'),
      DeviceFunction.fromString(DeviceLightLevelMotionTemperature.TemperatureTriggerFunctionName.TEMPERATURE_EQUALS, 'void')
    ];
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;

    // Check Motion triggers
    const isMotionTrigger = Object.values(DeviceLightLevelMotionTemperature.MotionTriggerFunctionName).includes(
      triggerName as (typeof DeviceLightLevelMotionTemperature.MotionTriggerFunctionName)[keyof typeof DeviceLightLevelMotionTemperature.MotionTriggerFunctionName]
    );
    if (isMotionTrigger) {
      this.checkMotionListener(triggerName);
      return;
    }

    // Check Light Level triggers
    const isLightLevelTrigger = Object.values(DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName).includes(
      triggerName as (typeof DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName)[keyof typeof DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName]
    );
    if (isLightLevelTrigger) {
      this.checkLightLevelListener(triggerName);
      return;
    }

    // Check Temperature triggers
    const isTemperatureTrigger = Object.values(DeviceLightLevelMotionTemperature.TemperatureTriggerFunctionName).includes(
      triggerName as (typeof DeviceLightLevelMotionTemperature.TemperatureTriggerFunctionName)[keyof typeof DeviceLightLevelMotionTemperature.TemperatureTriggerFunctionName]
    );
    if (isTemperatureTrigger) {
      this.checkTemperatureListener(triggerName);
      return;
    }
  }

  private checkMotionListener(triggerName: string) {
    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    if (triggerName === DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.SENSIBILITY_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.MOTION_DETECTED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.NO_MOTION_DETECTED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.MOTION_DETECTED_SINCE) {
      listeners.forEach(pair =>
        this.setupPeriodicCheckIfNeeded(pair, DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.MOTION_DETECTED_SINCE)
      );
    }
    if (triggerName === DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.NO_MOTION_DETECTED_SINCE) {
      listeners.forEach(pair =>
        this.setupPeriodicCheckIfNeeded(pair, DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.NO_MOTION_DETECTED_SINCE)
      );
    }
  }

  private checkLightLevelListener(triggerName: string) {
    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    if (triggerName === DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName.LEVEL_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName.LEVEL_GREATER) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.levelGreater(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName.LEVEL_LESS) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.levelLess(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName.DARK) {
      listeners.filter(() => this.dark()).forEach(pair => pair.run());
    }
    if (triggerName === DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName.BRIGHT) {
      listeners.filter(() => this.bright()).forEach(pair => pair.run());
    }
  }

  private checkTemperatureListener(triggerName: string) {
    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    if (triggerName === DeviceLightLevelMotionTemperature.TemperatureTriggerFunctionName.TEMPERATURE_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceLightLevelMotionTemperature.TemperatureTriggerFunctionName.TEMPERATURE_GREATER) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.temperatureGreater(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceLightLevelMotionTemperature.TemperatureTriggerFunctionName.TEMPERATURE_LESS) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.temperatureLess(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceLightLevelMotionTemperature.TemperatureTriggerFunctionName.TEMPERATURE_EQUALS) {
      listeners
        .filter(pair => {
          const target = pair.getParams()?.getParam1AsInt();
          return target != null && this.temperatureEquals(target);
        })
        .forEach(pair => pair.run());
    }
  }

  private setupPeriodicCheckIfNeeded(pair: DeviceListenerPair, triggerName: string) {
    const listenerKey = pair.getParams()?.key;
    if (!listenerKey) return;
    const existingTask = this.periodicCheckTasks.get(listenerKey);
    if (existingTask) {
      clearTimeout(existingTask);
      this.periodicCheckTasks.delete(listenerKey);
    }

    const seconds = pair.getParams()?.getParam1AsInt();
    if (!seconds || seconds <= 0) return;

    const remainingSeconds = this.calculateRemainingSeconds(seconds);
    if (remainingSeconds <= 0) {
      pair.run();
      return;
    }

    const checkTask = () => {
      let conditionMet = false;
      if (triggerName === DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.MOTION_DETECTED_SINCE) {
        conditionMet = this.isMotionDetectedSince(seconds);
      } else if (triggerName === DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.NO_MOTION_DETECTED_SINCE) {
        conditionMet = this.isNoMotionDetectedSince(seconds);
      }
      if (conditionMet) {
        pair.run();
        const task = this.periodicCheckTasks.get(listenerKey);
        if (task) {
          clearTimeout(task);
          this.periodicCheckTasks.delete(listenerKey);
        }
      } else {
        this.setupPeriodicCheckIfNeeded(pair, triggerName);
      }
    };

    const timeout = setTimeout(checkTask, remainingSeconds * 1000);
    this.periodicCheckTasks.set(listenerKey, timeout);
  }

  private calculateRemainingSeconds(seconds: number) {
    if (!this.motion_last_detect) {
      return seconds + 1;
    }
    const lastDetectTime = this.parseLastDetect();
    if (lastDetectTime === -1) return seconds + 1;
    const currentTime = Date.now();
    const elapsedSeconds = Math.floor((currentTime - lastDetectTime) / 1000);
    const remaining = seconds - elapsedSeconds;
    if (remaining < 0) return -1;
    return remaining + 1;
  }

  private parseLastDetect() {
    if (!this.motion_last_detect) return -1;
    if (/^\d+$/.test(this.motion_last_detect)) {
      return Number(this.motion_last_detect);
    }
    const parsed = Date.parse(this.motion_last_detect);
    return Number.isNaN(parsed) ? -1 : parsed;
  }

  // Motion methods
  motionActive() {
    return this.motion === true;
  }

  noMotion() {
    return !this.motionActive();
  }

  motionSince(seconds: number) {
    return this.isMotionDetectedSince(seconds);
  }

  noMotionSince(seconds: number) {
    return this.isNoMotionDetectedSince(seconds);
  }

  protected isMotionDetectedSince(seconds: number) {
    if (!this.motion_last_detect) return false;
    const lastDetectTime = this.parseLastDetect();
    if (lastDetectTime === -1) return false;
    const diffSeconds = Math.floor((Date.now() - lastDetectTime) / 1000);
    return diffSeconds >= seconds;
  }

  protected isNoMotionDetectedSince(seconds: number) {
    if (!this.motion_last_detect) return true;
    const lastDetectTime = this.parseLastDetect();
    if (lastDetectTime === -1) return true;
    const diffSeconds = Math.floor((Date.now() - lastDetectTime) / 1000);
    return diffSeconds >= seconds;
  }

  setSensibility(sensitivity: number, execute: boolean) {
    this.sensitivity = sensitivity;
    if (execute) {
      this.executeSetSensibility(sensitivity);
    }
    this.checkListener(DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.SENSIBILITY_CHANGED);
  }

  protected abstract executeSetSensibility(sensitivity: number): void;

  setMotion(motion: boolean, motion_last_detect: string, execute: boolean) {
    this.motion = motion;
    if (motion) {
      this.motion_last_detect = motion_last_detect;
    }
    if (execute) {
      this.executeSetMotion(motion, motion_last_detect);
    }
    if (motion) {
      this.checkListener(DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.MOTION_DETECTED);
    } else {
      this.checkListener(DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.NO_MOTION_DETECTED);
    }
    this.checkListener(DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.MOTION_DETECTED_SINCE);
    this.checkListener(DeviceLightLevelMotionTemperature.MotionTriggerFunctionName.NO_MOTION_DETECTED_SINCE);
  }

  protected abstract executeSetMotion(motion: boolean, motion_last_detect: string): void;

  // Light Level methods
  levelGreater(threshold: number) {
    return this.lightLevel != null && this.lightLevel > threshold;
  }

  levelLess(threshold: number) {
    return this.lightLevel != null && this.lightLevel < threshold;
  }

  levelEquals(value: number) {
    return this.lightLevel != null && this.lightLevel === value;
  }

  protected dark() {
    return this.lightLevel != null && this.lightLevel < 20;
  }

  protected bright() {
    return this.lightLevel != null && this.lightLevel >= 50;
  }

  setLightLevel(lightLevel: number, execute: boolean) {
    this.lightLevel = lightLevel;
    if (execute) {
      this.executeSetLightLevel(lightLevel);
    }
    this.checkListener(DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName.LEVEL_CHANGED);
    this.checkListener(DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName.LEVEL_GREATER);
    this.checkListener(DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName.LEVEL_LESS);
    this.checkListener(DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName.DARK);
    this.checkListener(DeviceLightLevelMotionTemperature.LightLevelTriggerFunctionName.BRIGHT);
  }

  protected abstract executeSetLightLevel(lightLevel: number): void;

  // Temperature methods
  temperatureGreater(threshold: number) {
    return this.temperature != null && this.temperature > threshold;
  }

  temperatureLess(threshold: number) {
    return this.temperature != null && this.temperature < threshold;
  }

  temperatureEquals(value: number) {
    return this.temperature != null && this.temperature === value;
  }

  setTemperature(temperature: number, execute: boolean) {
    this.temperature = temperature;
    if (execute) {
      this.executeSetTemperature(temperature);
    }
    this.checkListener(DeviceLightLevelMotionTemperature.TemperatureTriggerFunctionName.TEMPERATURE_CHANGED);
    this.checkListener(DeviceLightLevelMotionTemperature.TemperatureTriggerFunctionName.TEMPERATURE_GREATER);
    this.checkListener(DeviceLightLevelMotionTemperature.TemperatureTriggerFunctionName.TEMPERATURE_LESS);
    this.checkListener(DeviceLightLevelMotionTemperature.TemperatureTriggerFunctionName.TEMPERATURE_EQUALS);
  }

  protected abstract executeSetTemperature(temperature: number): void;
}

