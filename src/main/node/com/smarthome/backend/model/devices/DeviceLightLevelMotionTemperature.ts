import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventTemperatureChanged } from "../../server/events/events/EventTemperatureChanged.js";
import { EventTemperatureEquals } from "../../server/events/events/EventTemperatureEquals.js";
import { EventTemperatureLess } from "../../server/events/events/EventTemperatureLess.js";
import { EventTemperatureGreater } from "../../server/events/events/EventTemperatureGreater.js";
import { EventSensibilityChanged } from "../../server/events/events/EventSensibilityChanged.js";
import { EventMotionDetected } from "../../server/events/events/EventMotionDetected.js";
import { EventNoMotionDetected } from "../../server/events/events/EventNoMotionDetected.js";
import { EventMotionDetectedSince } from "../../server/events/events/EventMotionDetectedSince.js";
import { EventNoMotionDetectedSince } from "../../server/events/events/EventNoMotionDetectedSince.js";
import { EventLightLevelStatusChanged } from "../../server/events/events/EventLightLevelStatusChanged.js";
import { EventLightLevelBright } from "../../server/events/events/EventLightLevelBright.js";
import { EventLightLevelDark } from "../../server/events/events/EventLightLevelDark.js";
import { EventLightLevelGreater } from "../../server/events/events/EventLightLevelGreater.js";
import { EventLightLevelLess } from "../../server/events/events/EventLightLevelLess.js";
import { EventMotionStatusChanged } from "../../server/events/events/EventMotionStatusChanged.js";

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
  
  isDark(): boolean {
    return (this.lightLevel ?? 0) < 20;
  }
  isBright(): boolean {
    return (this.lightLevel ?? 0) > 50;
  }
  isLightLevelGreater(lightLevel: number): boolean {
    return (this.lightLevel ?? 0) > lightLevel;
  }
  isLightLevelLess(lightLevel: number): boolean {
    return (this.lightLevel ?? 0) < lightLevel;
  }
  isTemperatureGreater(temperature: number): boolean {
    return (this.temperature ?? 0) > temperature;
  }
  isTemperatureLess(temperature: number): boolean {
    return (this.temperature ?? 0) < temperature;
  }
  isTemperatureEquals(temperature: number): boolean {
    return (this.temperature ?? 0) === temperature;
  }

  isMotionDetectedSince(seconds: number): boolean {
    const t = this.timeStringToMiliseconds(this.motion_last_detect ?? '');
    if (t === null) return false;
    return Date.now() - t <= seconds * 1000;
  }

  isNoMotionDetectedSince(seconds: number): boolean {
    const t = this.timeStringToMiliseconds(this.motion_last_detect ?? '');
    if (t === null) return true;
    return Date.now() - t >= seconds * 1000;
  }

  async setSensibility(sensitivity: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.sensitivity = sensitivity;
    if (execute) {
      await this.executeSetSensibility(sensitivity);
    }
    if (trigger) {
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
      this.eventManager?.triggerEvent(new EventMotionStatusChanged(this.id, deviceBefore, {...this}));
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
      this.eventManager?.triggerEvent(new EventLightLevelStatusChanged(this.id, deviceBefore, {...this}));
      this.eventManager?.triggerEvent(new EventLightLevelDark(this.id, deviceBefore, lightLevel));
      this.eventManager?.triggerEvent(new EventLightLevelBright(this.id, deviceBefore, lightLevel));
      this.eventManager?.triggerEvent(new EventLightLevelGreater(this.id, deviceBefore, lightLevel));
      this.eventManager?.triggerEvent(new EventLightLevelLess(this.id, deviceBefore, lightLevel));
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
      this.eventManager?.triggerEvent(new EventTemperatureChanged(this.id, deviceBefore, temperature));
      this.eventManager?.triggerEvent(new EventTemperatureEquals(this.id, deviceBefore, temperature));
      this.eventManager?.triggerEvent(new EventTemperatureLess(this.id, deviceBefore, temperature));
      this.eventManager?.triggerEvent(new EventTemperatureGreater(this.id, deviceBefore, temperature));
    }
  }

  protected abstract executeSetTemperature(temperature: number): Promise<void>;
}
