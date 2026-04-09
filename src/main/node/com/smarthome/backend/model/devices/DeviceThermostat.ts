import { DeviceType } from "./helper/DeviceType.js";
import { DeviceTemperature } from "./DeviceTemperature.js";
import { EventTemperatureGoalChanged } from "../../server/events/events/EventTemperatureGoalChanged.js";
import { EventTemperatureGoalReached } from "../../server/events/events/EventTemperatureGoalReached.js";
import { EventTemperatureSchedulesChanged } from "../../server/events/events/EventTemperatureSchedulesChanged.js";
import { EventThermostatStateChanged } from "../../server/events/events/EventThermostatStateChanged.js";
import { EventThermostatStateCooling } from "../../server/events/events/EventThermostatStateCooling.js";
import { EventThermostatStateHeating } from "../../server/events/events/EventThermostatStateHeating.js";
import { EventThermostatStateOff } from "../../server/events/events/EventThermostatStateOff.js";
import { EventTemperatureGreater } from "../../server/events/events/EventTemperatureGreater.js";
import { EventTemperatureLess } from "../../server/events/events/EventTemperatureLess.js";
import { EventTemperatureEquals } from "../../server/events/events/EventTemperatureEquals.js";
import { EventTemperatureChanged } from "../../server/events/events/EventTemperatureChanged.js";

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
  state: 'cooling' | 'heating' | 'off' = 'off';

  constructor(init?: Partial<DeviceThermostat>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.THERMOSTAT;
  }

  abstract delete(): Promise<void>;

  private static readonly STATE_MAP: Record<string, number> = { off: 0, heating: 1, cooling: 2 };

  override toDatabaseJson(): Record<string, unknown> {
    return {
      ...super.toDatabaseJson(),
      tg: this.temperatureGoal,
      st: DeviceThermostat.STATE_MAP[this.state] ?? 0,
    };
  }

  isTemperatureGoalReached(): boolean {
    if (this.state === 'cooling') {
      return (this.temperature ?? 0) <= (this.temperatureGoal ?? 0);
    } else if (this.state === 'heating') {
      return (this.temperature ?? 0) >= (this.temperatureGoal ?? 0);
    } else {
      return true;
    }
  }
  
  async setState(state: 'cooling' | 'heating' | 'off', execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.state = state;
    if( execute) {
      if( state === 'cooling') {
        this.setTemperatureGoal((this.temperature ?? 20.5) - 3, execute, trigger);
      } else if (state === 'heating') {
        this.setTemperatureGoal((this.temperature ?? 19.5) + 3, execute, trigger);
      } else {
        this.setTemperatureGoal(-999, execute, trigger);
      }
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventThermostatStateChanged(this.id, deviceBefore, state));
      if (state === 'cooling') {
        this.eventManager?.triggerEvent(new EventThermostatStateCooling(this.id, deviceBefore));
      } else if (state === 'heating') {
        this.eventManager?.triggerEvent(new EventThermostatStateHeating(this.id, deviceBefore));
      } else {
        this.eventManager?.triggerEvent(new EventThermostatStateOff(this.id, deviceBefore));
      }
    }
  }

  async setTemperature(temperature: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.temperature = temperature;
    this.addTemperatureToHistory(temperature);
    if (trigger) {
      this.eventManager?.triggerEvent(new EventTemperatureChanged(this.id, deviceBefore, temperature));
      this.eventManager?.triggerEvent(new EventTemperatureEquals(this.id, deviceBefore, temperature));
      this.eventManager?.triggerEvent(new EventTemperatureLess(this.id, deviceBefore, temperature));
      this.eventManager?.triggerEvent(new EventTemperatureGreater(this.id, deviceBefore, temperature));
      if( this.temperatureGoal === this.temperature) {
        this.eventManager?.triggerEvent(new EventTemperatureGoalReached(this.id, deviceBefore, this.temperatureGoal));
      }
    }
  }


  async setTemperatureGoal(temperatureGoal: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.temperatureGoal = temperatureGoal;
    if( this.temperatureGoal === -999) {
      this.setState('off', false, trigger);
    } else if( this.temperatureGoal <= (this.temperature ?? 0)) {
      this.setState('cooling', false, trigger);
    } else if (this.temperatureGoal > (this.temperature ?? 0)) {
      this.setState('heating', false, trigger);
    } 
    if (execute) {
      await this.executeSetTemperatureGoal(temperatureGoal);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventTemperatureGoalChanged(this.id, deviceBefore, temperatureGoal));
      this.eventManager?.triggerEvent(new EventTemperatureGoalReached(this.id, deviceBefore, temperatureGoal));
    }
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

