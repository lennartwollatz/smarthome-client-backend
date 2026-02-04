import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";

export abstract class DeviceLight extends Device {
  static TriggerFunctionName = {
    TOGGLED: "toggled",
    ON_ON: "onOn",
    ON_OFF: "onOff"
  } as const;

  static ActionFunctionName = {
    SET_ON: "setOn",
    SET_OFF: "setOff",
    TOGGLE: "toggle"
  } as const;

  static BoolFunctionName = {
    ON: "on",
    OFF: "off"
  } as const;

  on?: boolean;

  constructor(init?: Partial<DeviceLight>) {
    super();
    Object.assign(this, init);
    this.type = DeviceType.LIGHT;
    this.icon = "&#128161;";
    this.typeLabel = "deviceType.light";
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  abstract updateValues(): void;

  protected override initializeFunctionsBool() {
    this.functionsBool = [
      DeviceFunction.fromString(DeviceLight.BoolFunctionName.ON, 'bool'),
      DeviceFunction.fromString(DeviceLight.BoolFunctionName.OFF, 'bool')
    ];
  }

  protected override initializeFunctionsAction() {
    this.functionsAction = [
      DeviceFunction.fromString(DeviceLight.ActionFunctionName.SET_ON, 'void'),
      DeviceFunction.fromString(DeviceLight.ActionFunctionName.SET_OFF, 'void'),
      DeviceFunction.fromString(DeviceLight.ActionFunctionName.TOGGLE, 'void')
    ];
  }

  protected override initializeFunctionsTrigger() {
    this.functionsTrigger = [
      DeviceFunction.fromString(DeviceLight.TriggerFunctionName.TOGGLED, 'void'),
      DeviceFunction.fromString(DeviceLight.TriggerFunctionName.ON_ON, 'void'),
      DeviceFunction.fromString(DeviceLight.TriggerFunctionName.ON_OFF, 'void')
    ];
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    const isValid = Object.values(DeviceLight.TriggerFunctionName).includes(
      triggerName as (typeof DeviceLight.TriggerFunctionName)[keyof typeof DeviceLight.TriggerFunctionName]
    );
    if (!isValid) return;
    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;
    listeners.forEach(listener => listener.run());
  }

  isOn() {
    return this.on === true;
  }

  isOff() {
    return !this.isOn();
  }

  setOn(execute: boolean) {
    const oldOn = this.on;
    this.on = true;
    if (execute) {
      this.executeSetOn();
    }
    this.checkListener(DeviceLight.TriggerFunctionName.ON_ON);
    const changed = oldOn == null || oldOn !== this.on;
    if (changed) {
      this.checkListener(DeviceLight.TriggerFunctionName.TOGGLED);
    }
  }

  protected abstract executeSetOn(): void;

  setOff(execute: boolean) {
    const oldOn = this.on;
    this.on = false;
    if (execute) {
      this.executeSetOff();
    }
    this.checkListener(DeviceLight.TriggerFunctionName.ON_OFF);
    const changed = oldOn == null || oldOn !== this.on;
    if (changed) {
      this.checkListener(DeviceLight.TriggerFunctionName.TOGGLED);
    }
  }

  protected abstract executeSetOff(): void;

  toggle() {
    this.on = !this.on;
    if (this.on) {
      this.executeSetOn();
    } else {
      this.executeSetOff();
    }
    this.checkListener(DeviceLight.TriggerFunctionName.TOGGLED);
    if (this.on) {
      this.checkListener(DeviceLight.TriggerFunctionName.ON_ON);
    } else {
      this.checkListener(DeviceLight.TriggerFunctionName.ON_OFF);
    }
  }
}
