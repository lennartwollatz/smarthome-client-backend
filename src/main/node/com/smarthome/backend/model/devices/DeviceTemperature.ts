import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";

export abstract class DeviceTemperature extends Device {
  static TriggerFunctionName = {
    TEMPERATURE_CHANGED: "temperatureChanged",
    TEMPERATURE_GREATER: "temperatureGreater(int)",
    TEMPERATURE_LESS: "temperatureLess(int)",
    TEMPERATURE_EQUALS: "temperatureEquals(int)"
  } as const;

  static BoolFunctionName = {
    TEMPERATURE_GREATER: "temperatureGreater(int)",
    TEMPERATURE_LESS: "temperatureLess(int)",
    TEMPERATURE_EQUALS: "temperatureEquals(int)"
  } as const;

  temperature?: number;

  constructor(init?: Partial<DeviceTemperature>) {
    super();
    Object.assign(this, init);
    this.type = DeviceType.TEMPERATURE;
    this.icon = "&#127777;";
    this.typeLabel = "deviceType.temperature";
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  abstract updateValues(): void;

  protected override initializeFunctionsBool() {
    this.functionsBool = [
      DeviceFunction.fromString(DeviceTemperature.BoolFunctionName.TEMPERATURE_GREATER, 'bool'),
      DeviceFunction.fromString(DeviceTemperature.BoolFunctionName.TEMPERATURE_LESS, 'bool'),
      DeviceFunction.fromString(DeviceTemperature.BoolFunctionName.TEMPERATURE_EQUALS, 'bool')
    ];
  }

  protected override initializeFunctionsAction() {
    this.functionsAction = [];
  }

  protected override initializeFunctionsTrigger() {
    this.functionsTrigger = [
      DeviceFunction.fromString(DeviceTemperature.TriggerFunctionName.TEMPERATURE_CHANGED, 'void'),
      DeviceFunction.fromString(DeviceTemperature.TriggerFunctionName.TEMPERATURE_GREATER, 'void'),
      DeviceFunction.fromString(DeviceTemperature.TriggerFunctionName.TEMPERATURE_LESS, 'void'),
      DeviceFunction.fromString(DeviceTemperature.TriggerFunctionName.TEMPERATURE_EQUALS, 'void')
    ];
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    const isValid = Object.values(DeviceTemperature.TriggerFunctionName).includes(
      triggerName as (typeof DeviceTemperature.TriggerFunctionName)[keyof typeof DeviceTemperature.TriggerFunctionName]
    );
    if (!isValid) return;
    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    if (triggerName === DeviceTemperature.TriggerFunctionName.TEMPERATURE_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
    if (triggerName === DeviceTemperature.TriggerFunctionName.TEMPERATURE_GREATER) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.temperatureGreater(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceTemperature.TriggerFunctionName.TEMPERATURE_LESS) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.temperatureLess(threshold);
        })
        .forEach(pair => pair.run());
    }
    if (triggerName === DeviceTemperature.TriggerFunctionName.TEMPERATURE_EQUALS) {
      listeners
        .filter(pair => {
          const target = pair.getParams()?.getParam1AsInt();
          return target != null && this.temperatureEquals(target);
        })
        .forEach(pair => pair.run());
    }
  }

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
    this.checkListener(DeviceTemperature.TriggerFunctionName.TEMPERATURE_CHANGED);
    this.checkListener(DeviceTemperature.TriggerFunctionName.TEMPERATURE_GREATER);
    this.checkListener(DeviceTemperature.TriggerFunctionName.TEMPERATURE_LESS);
    this.checkListener(DeviceTemperature.TriggerFunctionName.TEMPERATURE_EQUALS);
  }

  protected abstract executeSetTemperature(temperature: number): void;
}
