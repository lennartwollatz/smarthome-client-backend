import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventLightLevelMotionTemperatureStatusChanged } from "../../server/events/events/EventLightLevelMotionTemperatureStatusChanged.js";
import { EventBrightnessChanged } from "../../server/events/events/EventBrightnessChanged.js";
import { EventBrightnessEquals } from "../../server/events/events/EventBrightnessEquals.js";
import { EventBrightnessLess } from "../../server/events/events/EventBrightnessLess.js";
import { EventBrightnessGreater } from "../../server/events/events/EventBrightnessGreater.js";
import { EventTemperatureChanged } from "../../server/events/events/EventTemperatureChanged.js";
import { EventTemperatureEquals } from "../../server/events/events/EventTemperatureEquals.js";
import { EventTemperatureLess } from "../../server/events/events/EventTemperatureLess.js";
import { EventTemperatureGreater } from "../../server/events/events/EventTemperatureGreater.js";
import { EventSensibilityChanged } from "../../server/events/events/EventSensibilityChanged.js";
import { EventMotionDetected } from "../../server/events/events/EventMotionDetected.js";
import { EventNoMotionDetected } from "../../server/events/events/EventNoMotionDetected.js";
import { EventMotionDetectedSince } from "../../server/events/events/EventMotionDetectedSince.js";
import { EventNoMotionDetectedSince } from "../../server/events/events/EventNoMotionDetectedSince.js";

export abstract class DeviceLightLevelMotionTemperature extends Device {
  sensitivity?: number;
  motion?: boolean;
  motion_last_detect?: string;
  lightLevel?: number;
  temperature?: number;

  constructor(init?: Partial<DeviceLightLevelMotionTemperature>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.MOTION_LIGHT_LEVEL_TEMPERATURE;
  }

  abstract updateValues(): Promise<void>;


  async setSensibility(sensitivity: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.sensitivity = sensitivity;
    if (execute) {
      await this.executeSetSensibility(sensitivity);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventLightLevelMotionTemperatureStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSensibilityChanged(this.id, deviceBefore, sensitivity));
    }
  }

  protected abstract executeSetSensibility(sensitivity: number): Promise<void>;

  async setMotion(motion: boolean, motion_last_detect: string, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.motion = motion;
    if (motion) {
      this.motion_last_detect = motion_last_detect;
    }
    if (execute) {
      await this.executeSetMotion(motion, motion_last_detect);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventLightLevelMotionTemperatureStatusChanged(this.id, deviceBefore, { ...this }));
      if (motion) {
        this.eventManager?.triggerEvent(new EventMotionDetected(this.id, deviceBefore));
        this.eventManager?.triggerEvent(new EventMotionDetectedSince(this.id, deviceBefore, motion_last_detect));
      } else {
        this.eventManager?.triggerEvent(new EventNoMotionDetected(this.id, deviceBefore));
        this.eventManager?.triggerEvent(new EventNoMotionDetectedSince(this.id, deviceBefore, motion_last_detect));
      }
    }
  }

  protected abstract executeSetMotion(motion: boolean, motion_last_detect: string): Promise<void>;


  async setLightLevel(lightLevel: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.lightLevel = lightLevel;
    if (execute) {
      await this.executeSetLightLevel(lightLevel);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventLightLevelMotionTemperatureStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventBrightnessChanged(this.id, deviceBefore, lightLevel));
      this.eventManager?.triggerEvent(new EventBrightnessEquals(this.id, deviceBefore, lightLevel));
      this.eventManager?.triggerEvent(new EventBrightnessLess(this.id, deviceBefore, lightLevel));
      this.eventManager?.triggerEvent(new EventBrightnessGreater(this.id, deviceBefore, lightLevel));
    }
  }

  protected abstract executeSetLightLevel(lightLevel: number): Promise<void>;


  async setTemperature(temperature: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.temperature = temperature;
    if (execute) {
      await this.executeSetTemperature(temperature);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventLightLevelMotionTemperatureStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventTemperatureChanged(this.id, deviceBefore, temperature));
      this.eventManager?.triggerEvent(new EventTemperatureEquals(this.id, deviceBefore, temperature));
      this.eventManager?.triggerEvent(new EventTemperatureLess(this.id, deviceBefore, temperature));
      this.eventManager?.triggerEvent(new EventTemperatureGreater(this.id, deviceBefore, temperature));
    }
  }

  protected abstract executeSetTemperature(temperature: number): Promise<void>;
}
