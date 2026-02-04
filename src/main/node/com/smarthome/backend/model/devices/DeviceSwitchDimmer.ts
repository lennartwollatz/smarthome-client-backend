import { DeviceSwitch } from "./DeviceSwitch.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceType } from "./helper/DeviceType.js";
import { DeviceFunction } from "../DeviceFunction.js";

export abstract class DeviceSwitchDimmer extends DeviceSwitch {
  static DimmerTriggerFunctionName = {
    ON_BRIGHTNESS_CHANGED: "onBrightnessChange(int):int"
  } as const;

  constructor(init?: Partial<DeviceSwitchDimmer>) {
    super();
    Object.assign(this, init);
    this.buttons ??= {};
    this.type = DeviceType.SWITCH_DIMMER;
    this.icon = "🔌";
    this.typeLabel = "deviceType.switch-dimmer";
    this.initializeFunctionsBool();
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
  }

  protected override initializeFunctionsTrigger() {
    super.initializeFunctionsTrigger();
    const triggerFunctions = this.functionsTrigger ?? [];
    triggerFunctions.push(DeviceFunction.fromString(DeviceSwitchDimmer.DimmerTriggerFunctionName.ON_BRIGHTNESS_CHANGED, 'int'));
    this.functionsTrigger = triggerFunctions;
  }

  private checkDimmerListener(triggerName: string, buttonId: string, brightness: number) {
    if (!triggerName) return;
    const isValid = Object.values(DeviceSwitchDimmer.DimmerTriggerFunctionName).includes(
      triggerName as (typeof DeviceSwitchDimmer.DimmerTriggerFunctionName)[keyof typeof DeviceSwitchDimmer.DimmerTriggerFunctionName]
    );
    if (!isValid) return;
    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;
    if (triggerName === DeviceSwitchDimmer.DimmerTriggerFunctionName.ON_BRIGHTNESS_CHANGED) {
      listeners
        .filter(pair => {
          const listenerParam = pair.getParams()?.getParam1AsString();
          return listenerParam != null && listenerParam === buttonId;
        })
        .forEach(pair => pair.runWithValue(brightness));
    }
  }

  protected abstract executeSetBrightness(buttonId: string, brightness: number): void;

  override setLongPressed(buttonId: string, execute: boolean) {
    super.setLongPressed(buttonId, execute);
    const button = this.buttons?.[buttonId];
    if (!button) return;
    const start = button.getInitialPressTime();
    const end = button.getLastPressTime();
    const duration = end - start;
    const brightness = 1 - Math.trunc(duration / 4000);
    this.checkDimmerListener(
      DeviceSwitchDimmer.DimmerTriggerFunctionName.ON_BRIGHTNESS_CHANGED,
      buttonId,
      brightness
    );
  }
}
