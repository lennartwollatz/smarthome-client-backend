import { DeviceLightDimmer } from "./DeviceLightDimmer.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";

export abstract class DeviceLightDimmerTemperature extends DeviceLightDimmer {
  static ColorTemperatureTriggerFunctionName = {
    ON_TEMPERATURE_EQUALS: "onTemperatureEquals(int)",
    ON_TEMPERATURE_LESS: "onTemperatureLess(int)",
    ON_TEMPERATURE_GREATER: "onTemperatureGreater(int)",
    ON_TEMPERATURE_CHANGED: "onTemperatureChanged"
  } as const;

  static ColorTemperatureActionFunctionName = {
    SET_TEMPERATURE: "setTemperature(int)"
  } as const;

  static ColorTemperatureBoolFunctionName = {
    TEMPERATURE_EQUALS: "temperatureEquals(int)",
    TEMPERATURE_LESS: "temperatureLess(int)",
    TEMPERATURE_GREATER: "temperatureGreater(int)"
  } as const;

  temperature?: number;

  constructor(init?: Partial<DeviceLightDimmerTemperature>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.LIGHT_DIMMER_TEMPERATURE;
    this.icon = "&#128161;";
    this.typeLabel = "deviceType.light-dimmer-temperature";
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  protected override initializeFunctionsBool() {
    super.initializeFunctionsBool();
    const functions = this.functionsBool ?? [];
    functions.push(DeviceFunction.fromString(DeviceLightDimmerTemperature.ColorTemperatureBoolFunctionName.TEMPERATURE_EQUALS, 'bool'));
    functions.push(DeviceFunction.fromString(DeviceLightDimmerTemperature.ColorTemperatureBoolFunctionName.TEMPERATURE_LESS, 'bool'));
    functions.push(DeviceFunction.fromString(DeviceLightDimmerTemperature.ColorTemperatureBoolFunctionName.TEMPERATURE_GREATER, 'bool'));
    this.functionsBool = functions;
  }

  protected override initializeFunctionsAction() {
    super.initializeFunctionsAction();
    const functions = this.functionsAction ?? [];
    functions.push(DeviceFunction.fromString(DeviceLightDimmerTemperature.ColorTemperatureActionFunctionName.SET_TEMPERATURE, 'void'));
    this.functionsAction = functions;
  }

  protected override initializeFunctionsTrigger() {
    super.initializeFunctionsTrigger();
    const functions = this.functionsTrigger ?? [];
    functions.push(DeviceFunction.fromString(DeviceLightDimmerTemperature.ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_EQUALS, 'void'));
    functions.push(DeviceFunction.fromString(DeviceLightDimmerTemperature.ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_LESS, 'void'));
    functions.push(DeviceFunction.fromString(DeviceLightDimmerTemperature.ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_GREATER, 'void'));
    functions.push(DeviceFunction.fromString(DeviceLightDimmerTemperature.ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_CHANGED, 'void'));
    this.functionsTrigger = functions;
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    const isValid = Object.values(DeviceLightDimmerTemperature.ColorTemperatureTriggerFunctionName).includes(
      triggerName as (typeof DeviceLightDimmerTemperature.ColorTemperatureTriggerFunctionName)[keyof typeof DeviceLightDimmerTemperature.ColorTemperatureTriggerFunctionName]
    );
    if (!isValid) return;

    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    if (triggerName === DeviceLightDimmerTemperature.ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_CHANGED) {
      listeners.forEach(listener => listener.run());
    }

    if (triggerName === DeviceLightDimmerTemperature.ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_EQUALS) {
      listeners
        .filter(pair => {
          const target = pair.getParams()?.getParam1AsInt();
          return target != null && this.temperatureEquals(target);
        })
        .forEach(pair => pair.run());
    }

    if (triggerName === DeviceLightDimmerTemperature.ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_LESS) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.temperatureLess(threshold);
        })
        .forEach(pair => pair.run());
    }

    if (triggerName === DeviceLightDimmerTemperature.ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_GREATER) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.temperatureGreater(threshold);
        })
        .forEach(pair => pair.run());
    }
  }

  temperatureEquals(value: number) {
    return this.temperature != null && this.temperature === value;
  }

  temperatureLess(threshold: number) {
    return this.temperature != null && this.temperature < threshold;
  }

  temperatureGreater(threshold: number) {
    return this.temperature != null && this.temperature > threshold;
  }

  setTemperature(temperature: number, execute: boolean) {
    this.temperature = temperature;
    if (execute) {
      this.executeSetTemperature(temperature);
    }
    this.checkListener(DeviceLightDimmerTemperature.ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_CHANGED);
    this.checkListener(DeviceLightDimmerTemperature.ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_EQUALS);
    this.checkListener(DeviceLightDimmerTemperature.ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_LESS);
    this.checkListener(DeviceLightDimmerTemperature.ColorTemperatureTriggerFunctionName.ON_TEMPERATURE_GREATER);
  }

  protected abstract executeSetTemperature(temperature: number): void;
}
