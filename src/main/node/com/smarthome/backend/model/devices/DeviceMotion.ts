import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventMotionStatusChanged } from "../../server/events/events/EventMotionStatusChanged.js";
import { EventSensibilityChanged } from "../../server/events/events/EventSensibilityChanged.js";
import { EventMotionDetected } from "../../server/events/events/EventMotionDetected.js";
import { EventNoMotionDetected } from "../../server/events/events/EventNoMotionDetected.js";
import { EventMotionDetectedSince } from "../../server/events/events/EventMotionDetectedSince.js";
import { EventNoMotionDetectedSince } from "../../server/events/events/EventNoMotionDetectedSince.js";

export abstract class DeviceMotion extends Device {
  sensitivity?: number;
  motion?: boolean;
  motion_last_detect?: string;

  constructor(init?: Partial<DeviceMotion>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.MOTION;
  }

  abstract updateValues(): Promise<void>;

  async setSensibility(sensitivity: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.sensitivity = sensitivity;
    if (execute) {
      await this.executeSetSensibility(sensitivity);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventMotionStatusChanged(this.id, deviceBefore, { ...this }));
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
      this.eventManager?.triggerEvent(new EventMotionStatusChanged(this.id, deviceBefore, { ...this }));
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
}
