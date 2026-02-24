import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";

export abstract class DeviceLightLevel extends Device {
  static TriggerFunctionName = {
    LEVEL_CHANGED: "levelChanged",
    LEVEL_GREATER: "levelGreater(int)",
    LEVEL_LESS: "levelLess(int)",
    LEVEL_REACHES: "levelReaches(int)",
    DARK: "dark",
    BRIGHT: "bright"
  } as const;

  static BoolFunctionName = {
    DARK: "dark",
    BRIGHT: "bright",
    LEVEL_GREATER: "levelGreater(int)",
    LEVEL_LESS: "levelLess(int)",
    LEVEL_EQUALS: "levelEquals(int)"
  } as const;

  // Feldname für Frontend-Kompatibilität
  lightLevel?: number;

  constructor(init?: Partial<DeviceLightLevel>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.LIGHT_LEVEL;
    this.icon = "&#9728;";
    this.typeLabel = "deviceType.lightLevel";
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  abstract updateValues(): Promise<void>;

  protected override initializeFunctionsBool() {
    this.functionsBool = [
      DeviceFunction.fromString(DeviceLightLevel.BoolFunctionName.DARK, 'bool'),
      DeviceFunction.fromString(DeviceLightLevel.BoolFunctionName.BRIGHT, 'bool'),
      DeviceFunction.fromString(DeviceLightLevel.BoolFunctionName.LEVEL_GREATER, 'bool'),
      DeviceFunction.fromString(DeviceLightLevel.BoolFunctionName.LEVEL_LESS, 'bool'),
      DeviceFunction.fromString(DeviceLightLevel.BoolFunctionName.LEVEL_EQUALS, 'bool')
    ];
  }

  protected override initializeFunctionsAction() {
    this.functionsAction = [];
  }

  protected override initializeFunctionsTrigger() {
    this.functionsTrigger = [
      DeviceFunction.fromString(DeviceLightLevel.TriggerFunctionName.LEVEL_CHANGED, 'void'),
      DeviceFunction.fromString(DeviceLightLevel.TriggerFunctionName.LEVEL_GREATER, 'void'),
      DeviceFunction.fromString(DeviceLightLevel.TriggerFunctionName.LEVEL_LESS, 'void'),
      DeviceFunction.fromString(DeviceLightLevel.TriggerFunctionName.DARK, 'void'),
      DeviceFunction.fromString(DeviceLightLevel.TriggerFunctionName.BRIGHT, 'void')
    ];
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    const isValid = Object.values(DeviceLightLevel.TriggerFunctionName).includes(
      triggerName as (typeof DeviceLightLevel.TriggerFunctionName)[keyof typeof DeviceLightLevel.TriggerFunctionName]
    );
    if (!isValid) return;
    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    if (triggerName === DeviceLightLevel.TriggerFunctionName.LEVEL_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceLightLevel.TriggerFunctionName.LEVEL_GREATER) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.levelGreater(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceLightLevel.TriggerFunctionName.LEVEL_LESS) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.levelLess(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceLightLevel.TriggerFunctionName.DARK) {
      listeners.filter(() => this.dark()).forEach(pair => pair.run());
    }
    if (triggerName === DeviceLightLevel.TriggerFunctionName.BRIGHT) {
      listeners.filter(() => this.bright()).forEach(pair => pair.run());
    }
  }

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
    return this.lightLevel != null && this.lightLevel < 7;
  }

  protected bright() {
    return this.lightLevel != null && this.lightLevel >= 7;
  }

  setLightLevel(lightLevel: number, execute: boolean) {
    this.lightLevel = lightLevel;
    if (execute) {
      this.executeSetLightLevel(lightLevel);
    }
    this.checkListener(DeviceLightLevel.TriggerFunctionName.LEVEL_CHANGED);
    this.checkListener(DeviceLightLevel.TriggerFunctionName.LEVEL_GREATER);
    this.checkListener(DeviceLightLevel.TriggerFunctionName.LEVEL_LESS);
    this.checkListener(DeviceLightLevel.TriggerFunctionName.DARK);
    this.checkListener(DeviceLightLevel.TriggerFunctionName.BRIGHT);
  }

  protected abstract executeSetLightLevel(lightLevel: number): void;
}
