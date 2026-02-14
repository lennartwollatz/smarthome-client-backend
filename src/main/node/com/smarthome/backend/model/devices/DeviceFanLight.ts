import { DeviceFan } from "./DeviceFan.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";

export abstract class DeviceFanLight extends DeviceFan {
  lightOn?: boolean;
  lightBrightness?: number;

  static LightTriggerFunctionName = {
    ON_LIGHT_ON: "onLightOn",
    ON_LIGHT_OFF: "onLightOff",
    ON_LIGHT_CHANGED: "onLightChanged",
    ON_LIGHT_BRIGHTNESS_EQUALS: "onLightBrightnessEquals(int)",
    ON_LIGHT_BRIGHTNESS_LESS: "onLightBrightnessLess(int)",
    ON_LIGHT_BRIGHTNESS_GREATER: "onLightBrightnessGreater(int)",
    ON_LIGHT_BRIGHTNESS_CHANGED: "onLightBrightnessChanged"
  } as const;

  static LightActionFunctionName = {
    SET_LIGHT_ON: "setLightOn",
    SET_LIGHT_OFF: "setLightOff",
    SET_LIGHT_BRIGHTNESS: "setLightBrightness(int)"
  } as const;

  static LightBoolFunctionName = {
    LIGHT_BRIGHTNESS_EQUALS: "lightBrightnessEquals(int)",
    LIGHT_BRIGHTNESS_LESS: "lightBrightnessLess(int)",
    LIGHT_BRIGHTNESS_GREATER: "lightBrightnessGreater(int)",
    LIGHT_ON: "lightOn",
    LIGHT_OFF: "lightOff"
  } as const;

  constructor(init?: Partial<DeviceFanLight>) {
    super();
    Object.assign(this, init);
    this.type = DeviceType.FAN_LIGHT;
    this.icon = "&#127744;";
    this.typeLabel = "deviceType.fan-light";
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  protected override initializeFunctionsBool() {
    super.initializeFunctionsBool();
    const functions = this.functionsBool ?? [];
    functions.push(DeviceFunction.fromString(DeviceFanLight.LightBoolFunctionName.LIGHT_ON, "bool"));
    functions.push(DeviceFunction.fromString(DeviceFanLight.LightBoolFunctionName.LIGHT_OFF, "bool"));
    functions.push(DeviceFunction.fromString(DeviceFanLight.LightBoolFunctionName.LIGHT_BRIGHTNESS_EQUALS, "bool"));
    functions.push(DeviceFunction.fromString(DeviceFanLight.LightBoolFunctionName.LIGHT_BRIGHTNESS_LESS, "bool"));
    functions.push(DeviceFunction.fromString(DeviceFanLight.LightBoolFunctionName.LIGHT_BRIGHTNESS_GREATER, "bool"));
    this.functionsBool = functions;
  }

  protected override initializeFunctionsAction() {
    super.initializeFunctionsAction();
    const functions = this.functionsAction ?? [];
    functions.push(DeviceFunction.fromString(DeviceFanLight.LightActionFunctionName.SET_LIGHT_ON, "void"));
    functions.push(DeviceFunction.fromString(DeviceFanLight.LightActionFunctionName.SET_LIGHT_OFF, "void"));
    functions.push(DeviceFunction.fromString(DeviceFanLight.LightActionFunctionName.SET_LIGHT_BRIGHTNESS, "void"));
    this.functionsAction = functions;
  }

  protected override initializeFunctionsTrigger() {
    super.initializeFunctionsTrigger();
    const functions = this.functionsTrigger ?? [];
    functions.push(DeviceFunction.fromString(DeviceFanLight.LightTriggerFunctionName.ON_LIGHT_ON, "void"));
    functions.push(DeviceFunction.fromString(DeviceFanLight.LightTriggerFunctionName.ON_LIGHT_OFF, "void"));
    functions.push(DeviceFunction.fromString(DeviceFanLight.LightTriggerFunctionName.ON_LIGHT_CHANGED, "void"));
    functions.push(DeviceFunction.fromString(DeviceFanLight.LightTriggerFunctionName.ON_LIGHT_BRIGHTNESS_EQUALS, "void"));
    functions.push(DeviceFunction.fromString(DeviceFanLight.LightTriggerFunctionName.ON_LIGHT_BRIGHTNESS_LESS, "void"));
    functions.push(DeviceFunction.fromString(DeviceFanLight.LightTriggerFunctionName.ON_LIGHT_BRIGHTNESS_GREATER, "void"));
    functions.push(DeviceFunction.fromString(DeviceFanLight.LightTriggerFunctionName.ON_LIGHT_BRIGHTNESS_CHANGED, "void"));
    this.functionsTrigger = functions;
  }

  // Bool-Funktionen für Light
  isLightOn() {
    return this.lightOn === true;
  }

  isLightOff() {
    return !this.isLightOn();
  }

  lightBrightnessEquals(value: number) {
    return this.lightBrightness != null && this.lightBrightness === value;
  }

  lightBrightnessLess(threshold: number) {
    return this.lightBrightness != null && this.lightBrightness < threshold;
  }

  lightBrightnessGreater(threshold: number) {
    return this.lightBrightness != null && this.lightBrightness > threshold;
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    const isValid = Object.values(DeviceFanLight.LightTriggerFunctionName).includes(
      triggerName as (typeof DeviceFanLight.LightTriggerFunctionName)[keyof typeof DeviceFanLight.LightTriggerFunctionName]
    );
    if (!isValid) return;

    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;

    if (triggerName === DeviceFan.FanTriggerFunctionName.ON_SPEED_CHANGED) {
      listeners.forEach(listener => listener.run());
    }

    if (triggerName === DeviceFan.FanTriggerFunctionName.ON_SPEED_EQUALS) {
      listeners
        .filter(pair => {
          const target = pair.getParams()?.getParam1AsInt();
          return target != null && this.speedEquals(target);
        })
        .forEach(pair => pair.run());
    }

    if (triggerName === DeviceFan.FanTriggerFunctionName.ON_SPEED_LESS) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.speedLess(threshold);
        })
        .forEach(pair => pair.run());
    }

    if (triggerName === DeviceFan.FanTriggerFunctionName.ON_SPEED_GREATER) {
      listeners
        .filter(pair => {
          const threshold = pair.getParams()?.getParam1AsInt();
          return threshold != null && this.speedGreater(threshold);
        })
        .forEach(pair => pair.run());
    }
  }

  setLightOn(execute: boolean) {
    const oldLightOn = this.lightOn;
    this.lightOn = true;
    if (execute) {
      const result = this.executeSetLightOn();
      if (result instanceof Promise) {
        result.catch((error) => {
          // Fehler wird bereits in der Implementierung geloggt
        });
      }
    }
    this.checkListener(DeviceFanLight.LightTriggerFunctionName.ON_LIGHT_ON);
    const changed = oldLightOn == null || oldLightOn !== this.lightOn;
    if (changed) {
      this.checkListener(DeviceFanLight.LightTriggerFunctionName.ON_LIGHT_CHANGED);
    }
  }

  protected abstract executeSetLightOn(): void | Promise<void>;

  setLightOff(execute: boolean) {
    const oldLightOn = this.lightOn;
    this.lightOn = false;
    if (execute) {
      const result = this.executeSetLightOff();
      if (result instanceof Promise) {
        result.catch((error) => {
          // Fehler wird bereits in der Implementierung geloggt
        });
      }
    }
    this.checkListener(DeviceFanLight.LightTriggerFunctionName.ON_LIGHT_OFF);
    const changed = oldLightOn == null || oldLightOn !== this.lightOn;
    if (changed) {
      this.checkListener(DeviceFanLight.LightTriggerFunctionName.ON_LIGHT_CHANGED);
    }
  }

  protected abstract executeSetLightOff(): void | Promise<void>;

  setLightBrightness(brightness: number, execute: boolean) {
    this.lightBrightness = brightness;
    if (execute) {
      const result = this.executeSetLightBrightness(brightness);
      if (result instanceof Promise) {
        result.catch((error) => {
          // Fehler wird bereits in der Implementierung geloggt
        });
      }
    }
    this.checkListener(DeviceFanLight.LightTriggerFunctionName.ON_LIGHT_BRIGHTNESS_CHANGED);
    this.checkListener(DeviceFanLight.LightTriggerFunctionName.ON_LIGHT_BRIGHTNESS_EQUALS);
    this.checkListener(DeviceFanLight.LightTriggerFunctionName.ON_LIGHT_BRIGHTNESS_LESS);
    this.checkListener(DeviceFanLight.LightTriggerFunctionName.ON_LIGHT_BRIGHTNESS_GREATER);
  }

  protected abstract executeSetLightBrightness(brightness: number): void | Promise<void>;
}

