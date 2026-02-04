import { DeviceLight } from "./DeviceLight.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";

export abstract class DeviceLightDimmer extends DeviceLight {
  static DimmerTriggerFunctionName = {
    ON_BRIGHTNESS_EQUALS: "onBrightnessEquals(int)",
    ON_BRIGHTNESS_LESS: "onBrightnessLess(int)",
    ON_BRIGHTNESS_GREATER: "onBrightnessGreater(int)",
    ON_BRIGHTNESS_CHANGED: "onBrightnessChanged"
  } as const;

  static DimmerActionFunctionName = {
    SET_BRIGHTNESS: "setBrightness(int)"
  } as const;

  static DimmerBoolFunctionName = {
    BRIGHTNESS_EQUALS: "brightnessEquals(int)",
    BRIGHTNESS_LESS: "brightnessLess(int)",
    BRIGHTNESS_GREATER: "brightnessGreater(int)"
  } as const;

  brightness?: number;

  constructor(init?: Partial<DeviceLightDimmer>) {
    super();
    Object.assign(this, init);
    this.type = DeviceType.LIGHT_DIMMER;
    this.icon = "&#128161;";
    this.typeLabel = "deviceType.light-dimmer";
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  protected override initializeFunctionsBool() {
    super.initializeFunctionsBool();
    const functions = this.functionsBool ?? [];
    functions.push(DeviceFunction.fromString(DeviceLightDimmer.DimmerBoolFunctionName.BRIGHTNESS_EQUALS, 'bool'));
    functions.push(DeviceFunction.fromString(DeviceLightDimmer.DimmerBoolFunctionName.BRIGHTNESS_LESS, 'bool'));
    functions.push(DeviceFunction.fromString(DeviceLightDimmer.DimmerBoolFunctionName.BRIGHTNESS_GREATER, 'bool'));
    this.functionsBool = functions;
  }

  protected override initializeFunctionsAction() {
    super.initializeFunctionsAction();
    const functions = this.functionsAction ?? [];
    functions.push(DeviceFunction.fromString(DeviceLightDimmer.DimmerActionFunctionName.SET_BRIGHTNESS, 'void'));
    this.functionsAction = functions;
  }

  protected override initializeFunctionsTrigger() {
    super.initializeFunctionsTrigger();
    const functions = this.functionsTrigger ?? [];
    functions.push(DeviceFunction.fromString(DeviceLightDimmer.DimmerTriggerFunctionName.ON_BRIGHTNESS_EQUALS, 'void'));
    functions.push(DeviceFunction.fromString(DeviceLightDimmer.DimmerTriggerFunctionName.ON_BRIGHTNESS_LESS, 'void'));
    functions.push(DeviceFunction.fromString(DeviceLightDimmer.DimmerTriggerFunctionName.ON_BRIGHTNESS_GREATER, 'void'));
    functions.push(DeviceFunction.fromString(DeviceLightDimmer.DimmerTriggerFunctionName.ON_BRIGHTNESS_CHANGED, 'void'));
    this.functionsTrigger = functions;
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    const isValid = Object.values(DeviceLightDimmer.DimmerTriggerFunctionName).includes(
      triggerName as (typeof DeviceLightDimmer.DimmerTriggerFunctionName)[keyof typeof DeviceLightDimmer.DimmerTriggerFunctionName]
    );
    if (!isValid) return;

    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    if (triggerName === DeviceLightDimmer.DimmerTriggerFunctionName.ON_BRIGHTNESS_CHANGED) {
      listeners.forEach(listener => listener.run());
    }

    if (triggerName === DeviceLightDimmer.DimmerTriggerFunctionName.ON_BRIGHTNESS_EQUALS) {
      listeners
        .filter(pair => {
          const target = pair.getParams()?.getParam1AsInt();
          return target != null && this.brightnessEquals(target);
        })
        .forEach(pair => pair.run());
    }

    if (triggerName === DeviceLightDimmer.DimmerTriggerFunctionName.ON_BRIGHTNESS_LESS) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.brightnessLess(threshold);
        })
        .forEach(pair => pair.run());
    }

    if (triggerName === DeviceLightDimmer.DimmerTriggerFunctionName.ON_BRIGHTNESS_GREATER) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.brightnessGreater(threshold);
        })
        .forEach(pair => pair.run());
    }
  }

  brightnessEquals(value: number) {
    return this.brightness != null && this.brightness === value;
  }

  brightnessLess(threshold: number) {
    return this.brightness != null && this.brightness < threshold;
  }

  brightnessGreater(threshold: number) {
    return this.brightness != null && this.brightness > threshold;
  }

  setBrightness(brightness: number, execute: boolean) {
    this.brightness = brightness;
    if (execute) {
      this.executeSetBrightness(brightness);
    }
    this.checkListener(DeviceLightDimmer.DimmerTriggerFunctionName.ON_BRIGHTNESS_CHANGED);
    this.checkListener(DeviceLightDimmer.DimmerTriggerFunctionName.ON_BRIGHTNESS_EQUALS);
    this.checkListener(DeviceLightDimmer.DimmerTriggerFunctionName.ON_BRIGHTNESS_LESS);
    this.checkListener(DeviceLightDimmer.DimmerTriggerFunctionName.ON_BRIGHTNESS_GREATER);
  }

  protected abstract executeSetBrightness(brightness: number): void;
}
