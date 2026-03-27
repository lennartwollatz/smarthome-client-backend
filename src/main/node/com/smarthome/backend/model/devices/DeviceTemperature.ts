import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventTemperatureChanged } from "../../server/events/events/EventTemperatureChanged.js";
import { EventTemperatureEquals } from "../../server/events/events/EventTemperatureEquals.js";
import { EventTemperatureLess } from "../../server/events/events/EventTemperatureLess.js";
import { EventTemperatureGreater } from "../../server/events/events/EventTemperatureGreater.js";

export type TemperatureHistoryEntry = {
  datetime: number;
  temperature: number;
  temperatureGoal: number;
};

export abstract class DeviceTemperature extends Device {
  temperature?: number;
  temperatureHistory: TemperatureHistoryEntry[] = [];

  constructor(init?: Partial<DeviceTemperature>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.TEMPERATURE;
  }

  abstract updateValues(): Promise<void>;

  isTemperatureEquals(temperature: number): boolean {
    return (this.temperature ?? 0) === temperature;
  }
  isTemperatureLess(temperature: number): boolean {
    return (this.temperature ?? 0) < temperature;
  }
  isTemperatureGreater(temperature: number): boolean {
    return (this.temperature ?? 0) > temperature;
  }


  async setTemperature(temperature: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.temperature = temperature;
    this.addTemperatureToHistory(temperature);
    if (execute) {
      await this.executeSetTemperature(temperature);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventTemperatureChanged(this.id, deviceBefore, temperature));
      this.eventManager?.triggerEvent(new EventTemperatureEquals(this.id, deviceBefore, temperature));
      this.eventManager?.triggerEvent(new EventTemperatureLess(this.id, deviceBefore, temperature));
      this.eventManager?.triggerEvent(new EventTemperatureGreater(this.id, deviceBefore, temperature));
    }
  }

  protected abstract executeSetTemperature(temperature: number): Promise<void>;

  protected addTemperatureToHistory(temperature: number, temperatureGoal: number = -999) {
    this.temperatureHistory.push({
      datetime: Date.now(),
      temperature: temperature,
      temperatureGoal: temperatureGoal	
    });
  }
}
