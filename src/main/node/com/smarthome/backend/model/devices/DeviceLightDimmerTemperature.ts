import { DeviceLightDimmer } from "./DeviceLightDimmer.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventLightStatusChanged } from "../../server/events/events/EventLightStatusChanged.js";
import { EventLightTemperatureChanged } from "../../server/events/events/EventLightTemperatureChanged.js";
import { EventLightTemperatureEquals } from "../../server/events/events/EventLightTemperatureEquals.js";
import { EventLightTemperatureLess } from "../../server/events/events/EventLightTemperatureLess.js";
import { EventLightTemperatureGreater } from "../../server/events/events/EventLightTemperatureGreater.js";

export abstract class DeviceLightDimmerTemperature extends DeviceLightDimmer {
  temperature?: number;

  constructor(init?: Partial<DeviceLightDimmerTemperature>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.LIGHT_DIMMER_TEMPERATURE;
  }

  override toDatabaseJson(): Record<string, unknown> {
    return { ...super.toDatabaseJson(), t: this.temperature ?? 0 };
  }

  isLightTemperatureEquals(temperature: number): boolean {
    return this.temperature === temperature;
  }
  isLightTemperatureLess(temperature: number): boolean {
    return (this.temperature ?? 0) < temperature;
  }
  isLightTemperatureGreater(temperature: number): boolean {
    return (this.temperature ?? 0) > temperature;
  }

  async setTemperature(temperature: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.temperature = temperature;
    if (execute) {
      await this.executeSetTemperature(temperature);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventLightStatusChanged(this.id, deviceBefore, {...this}));
      this.eventManager?.triggerEvent(new EventLightTemperatureChanged(this.id, deviceBefore, temperature));
      this.eventManager?.triggerEvent(new EventLightTemperatureEquals(this.id, deviceBefore, temperature));
      this.eventManager?.triggerEvent(new EventLightTemperatureLess(this.id, deviceBefore, temperature));
      this.eventManager?.triggerEvent(new EventLightTemperatureGreater(this.id, deviceBefore, temperature));
    }
  }

  protected abstract executeSetTemperature(temperature: number): Promise<void>;
}
