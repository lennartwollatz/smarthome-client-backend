import { DeviceType } from "./helper/DeviceType.js";
import { DeviceTemperature } from "./DeviceTemperature.js";
import { EventTemperatureGoalChanged } from "../../server/events/events/EventTemperatureGoalChanged.js";
import { EventTemperatureGoalReached } from "../../server/events/events/EventTemperatureGoalReached.js";
import { EventTemperatureSchedulesChanged } from "../../server/events/events/EventTemperatureSchedulesChanged.js";

export type TemperatureScheduleTimeRange = {
  weekday: number;
  time: string;
  temperature: number;
};

export type TemperatureSchedule = {
  rulename: string;
  rulevalue: TemperatureScheduleTimeRange[];
  active: boolean;
};

export abstract class DeviceThermostat extends DeviceTemperature {
  temperatureGoal:number = 20;
  temperatureSchedule: TemperatureSchedule[] = [];

  constructor(init?: Partial<DeviceThermostat>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.THERMOSTAT;
  }


  async setTemperatureGoal(temperatureGoal: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.temperatureGoal = temperatureGoal;
    if (execute) {
      await this.executeSetTemperatureGoal(temperatureGoal);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventTemperatureGoalChanged(this.id, deviceBefore, temperatureGoal));
      this.eventManager?.triggerEvent(new EventTemperatureGoalReached(this.id, deviceBefore, temperatureGoal));
    }
  }

  protected addTemperatureToHistory(temperature: number) {
    super.addTemperatureToHistory(temperature, this.temperatureGoal);
  }

  async setTemperatureSchedules(temperatureSchedules: TemperatureSchedule[], execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.temperatureSchedule = temperatureSchedules ?? [];
    if (execute) {
      await this.executeSetTemperatureSchedules(temperatureSchedules);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventTemperatureSchedulesChanged(this.id, deviceBefore, temperatureSchedules));
    }
  }

  protected abstract executeSetTemperatureGoal(temperatureGoal: number): Promise<void>;
  protected abstract executeSetTemperatureSchedules(temperatureSchedules: TemperatureSchedule[]): Promise<void>;
}

