import { DeviceLightDimmerTemperature } from "./DeviceLightDimmerTemperature.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventLightStatusChanged } from "../../server/events/events/EventLightStatusChanged.js";
import { EventColorChanged } from "../../server/events/events/EventColorChanged.js";

export abstract class DeviceLightDimmerTemperatureColor extends DeviceLightDimmerTemperature {
  // Flache Struktur für Farbkoordinaten (CIE 1931), kompatibel mit Frontend
  colorX: number = 0.3127; // D65 White Point default
  colorY: number = 0.3290;

  constructor(init?: Partial<DeviceLightDimmerTemperatureColor>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.LIGHT_DIMMER_TEMPERATURE_COLOR;
  }

  override toDatabaseJson(): Record<string, unknown> {
    return { ...super.toDatabaseJson(), cx: this.colorX, cy: this.colorY };
  }

  async setColor(x: number, y: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.colorX = round3(Math.max(0, Math.min(1, x)));
    this.colorY = round3(Math.max(0, Math.min(1, y)));
    if (execute) {
      await this.executeSetColor(this.colorX, this.colorY);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventLightStatusChanged(this.id, deviceBefore, {...this}));
      this.eventManager?.triggerEvent(new EventColorChanged(this.id, deviceBefore, this.colorX, this.colorY));
    }
  }

  protected abstract executeSetColor(x: number, y: number): Promise<void>;
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}
