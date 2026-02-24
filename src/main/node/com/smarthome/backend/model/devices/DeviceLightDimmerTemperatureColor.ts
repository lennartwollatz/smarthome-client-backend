import { DeviceLightDimmerTemperature } from "./DeviceLightDimmerTemperature.js";
import { DeviceType } from "./helper/DeviceType.js";
import type { DeviceListenerPair } from "./helper/DeviceListenerPair.js";
import { DeviceFunction } from "../DeviceFunction.js";

export abstract class DeviceLightDimmerTemperatureColor extends DeviceLightDimmerTemperature {
  static ColorActionFunctionName = {
    SET_COLOR: "setColor(double,double)"
  } as const;

  static ColorTriggerFunctionName = {
    ON_COLOR_CHANGED: "onColorChanged"
  } as const;

  // Flache Struktur für Farbkoordinaten (CIE 1931), kompatibel mit Frontend
  colorX: number = 0.3127; // D65 White Point default
  colorY: number = 0.3290;

  constructor(init?: Partial<DeviceLightDimmerTemperatureColor>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.LIGHT_DIMMER_TEMPERATURE_COLOR;
    this.icon = "&#128161;";
    this.typeLabel = "deviceType.light-dimmer-temperature-color";
    this.initializeFunctionsAction();
    this.initializeFunctionsTrigger();
    this.initializeFunctionsBool();
  }

  protected override initializeFunctionsAction() {
    super.initializeFunctionsAction();
    const functions = this.functionsAction ?? [];
    functions.push(DeviceFunction.fromString(DeviceLightDimmerTemperatureColor.ColorActionFunctionName.SET_COLOR, 'void'));
    this.functionsAction = functions;
  }

  protected override initializeFunctionsTrigger() {
    super.initializeFunctionsTrigger();
    const functions = this.functionsTrigger ?? [];
    functions.push(DeviceFunction.fromString(DeviceLightDimmerTemperatureColor.ColorTriggerFunctionName.ON_COLOR_CHANGED, 'void'));
    this.functionsTrigger = functions;
  }

  protected override checkListener(triggerName: string) {
    super.checkListener(triggerName);
    if (!triggerName) return;
    const isValid = Object.values(DeviceLightDimmerTemperatureColor.ColorTriggerFunctionName).includes(
      triggerName as (typeof DeviceLightDimmerTemperatureColor.ColorTriggerFunctionName)[keyof typeof DeviceLightDimmerTemperatureColor.ColorTriggerFunctionName]
    );
    if (!isValid) return;
    const listeners = this.triggerListeners.get(triggerName) as DeviceListenerPair[] | undefined;
    if (!listeners || listeners.length === 0) return;
    if (triggerName === DeviceLightDimmerTemperatureColor.ColorTriggerFunctionName.ON_COLOR_CHANGED) {
      listeners.forEach(listener => listener.run());
    }
  }

  setColor(x: number, y: number, execute: boolean) {
    this.colorX = round3(Math.max(0, Math.min(1, x)));
    this.colorY = round3(Math.max(0, Math.min(1, y)));
    if (execute) {
      this.executeSetColor(this.colorX, this.colorY);
    }
    this.checkListener(DeviceLightDimmerTemperatureColor.ColorTriggerFunctionName.ON_COLOR_CHANGED);
  }

  getColor(): { x: number; y: number } {
    return { x: this.colorX, y: this.colorY };
  }

  protected abstract executeSetColor(x: number, y: number): void;
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}
