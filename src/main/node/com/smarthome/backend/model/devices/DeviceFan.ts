import { DeviceLight } from "./DeviceLight.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";

export abstract class DeviceFan extends DeviceLight {
  static FanTriggerFunctionName = {
    ON_SPEED_EQUALS: "onSpeedEquals(int)",
    ON_SPEED_LESS: "onSpeedLess(int)",
    ON_SPEED_GREATER: "onSpeedGreater(int)",
    ON_SPEED_CHANGED: "onSpeedChanged"
  } as const;

  static FanActionFunctionName = {
    SET_SPEED: "setSpeed(int)"
  } as const;

  static FanBoolFunctionName = {
    SPEED_EQUALS: "speedEquals(int)",
    SPEED_LESS: "speedLess(int)",
    SPEED_GREATER: "speedGreater(int)"
  } as const;

  speed?: number;

  constructor(init?: Partial<DeviceFan>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.FAN;
    this.icon = "&#127744;";
    this.typeLabel = "deviceType.fan";
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  protected override initializeFunctionsBool() {
    super.initializeFunctionsBool();
    const functions = this.functionsBool ?? [];
    functions.push(DeviceFunction.fromString(DeviceFan.FanBoolFunctionName.SPEED_EQUALS, "bool"));
    functions.push(DeviceFunction.fromString(DeviceFan.FanBoolFunctionName.SPEED_LESS, "bool"));
    functions.push(DeviceFunction.fromString(DeviceFan.FanBoolFunctionName.SPEED_GREATER, "bool"));
    this.functionsBool = functions;
  }

  protected override initializeFunctionsAction() {
    super.initializeFunctionsAction();
    const functions = this.functionsAction ?? [];
    functions.push(DeviceFunction.fromString(DeviceFan.FanActionFunctionName.SET_SPEED, "void"));
    this.functionsAction = functions;
  }

  protected override initializeFunctionsTrigger() {
    super.initializeFunctionsTrigger();
    const functions = this.functionsTrigger ?? [];
    functions.push(DeviceFunction.fromString(DeviceFan.FanTriggerFunctionName.ON_SPEED_EQUALS, "void"));
    functions.push(DeviceFunction.fromString(DeviceFan.FanTriggerFunctionName.ON_SPEED_LESS, "void"));
    functions.push(DeviceFunction.fromString(DeviceFan.FanTriggerFunctionName.ON_SPEED_GREATER, "void"));
    functions.push(DeviceFunction.fromString(DeviceFan.FanTriggerFunctionName.ON_SPEED_CHANGED, "void"));
    this.functionsTrigger = functions;
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    const isValid = Object.values(DeviceFan.FanTriggerFunctionName).includes(
      triggerName as (typeof DeviceFan.FanTriggerFunctionName)[keyof typeof DeviceFan.FanTriggerFunctionName]
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

  speedEquals(value: number) {
    return this.speed != null && this.speed === value;
  }

  speedLess(threshold: number) {
    return this.speed != null && this.speed < threshold;
  }

  speedGreater(threshold: number) {
    return this.speed != null && this.speed > threshold;
  }

  setSpeed(speed: number, execute: boolean) {
    this.speed = speed;
    if (execute) {
      this.executeSetSpeed(speed);
    }
    this.checkListener(DeviceFan.FanTriggerFunctionName.ON_SPEED_CHANGED);
    this.checkListener(DeviceFan.FanTriggerFunctionName.ON_SPEED_EQUALS);
    this.checkListener(DeviceFan.FanTriggerFunctionName.ON_SPEED_LESS);
    this.checkListener(DeviceFan.FanTriggerFunctionName.ON_SPEED_GREATER);
  }

  protected abstract executeSetSpeed(speed: number): void;
}

