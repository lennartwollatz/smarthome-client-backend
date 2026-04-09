import { DeviceLight } from "./DeviceLight.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventFanStatusChanged } from "../../server/events/events/EventFanStatusChanged.js";
import { EventFanSpeedChanged } from "../../server/events/events/EventFanSpeedChanged.js";
import { EventFanSpeedEquals } from "../../server/events/events/EventFanSpeedEquals.js";
import { EventFanSpeedLess } from "../../server/events/events/EventFanSpeedLess.js";
import { EventFanSpeedGreater } from "../../server/events/events/EventFanSpeedGreater.js";

export abstract class DeviceFan extends DeviceLight {
  speed?: number;

  constructor(init?: Partial<DeviceFan>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.FAN;
  }

  override toDatabaseJson(): Record<string, unknown> {
    return { ...super.toDatabaseJson(), sp: this.speed ?? 0 };
  }

  fanSpeedEquals(speed: number):boolean {
    return (this.speed ?? 0) === speed;
  }
  fanSpeedLess(speed: number):boolean {
    return (this.speed ?? 0) < speed;
  }
  fanSpeedGreater(speed: number):boolean {
    return (this.speed ?? 0) > speed;
  }

  async setSpeed(speed: number, execute: boolean, trigger: boolean = true) {
    let fanBefore = { ...this };
    this.speed = speed;
    if (execute) {
      await this.executeSetSpeed(speed);
    }
    if( trigger ){
      this.eventManager?.triggerEvent(new EventFanStatusChanged(this.id, fanBefore, {...this}));
      this.eventManager?.triggerEvent(new EventFanSpeedChanged(this.id, fanBefore, speed));
      this.eventManager?.triggerEvent(new EventFanSpeedEquals(this.id, fanBefore, speed));
      this.eventManager?.triggerEvent(new EventFanSpeedLess(this.id, fanBefore, speed));
      this.eventManager?.triggerEvent(new EventFanSpeedGreater(this.id, fanBefore, speed));
    }
  }

  protected abstract executeSetSpeed(speed: number): Promise<void>;
}

