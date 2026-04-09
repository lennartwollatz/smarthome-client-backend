import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventLightOn } from "../../server/events/events/EventLightOn.js";
import { EventLightOff } from "../../server/events/events/EventLightOff.js";
import { EventLightToggle } from "../../server/events/events/EventLightToggle.js";
import { EventLightStatusChanged } from "../../server/events/events/EventLightStatusChanged.js";

export abstract class DeviceLight extends Device {
  on?: boolean;

  constructor(init?: Partial<DeviceLight>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.LIGHT;
  }

  abstract updateValues(): Promise<void>;

  isLightOn(): boolean {
    return this.on === true;
  }
  isLightOff(): boolean {
    return this.on === false;
  }

  async setOn(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.on = true;
    if (execute) {
      await this.executeSetOn();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventLightStatusChanged(this.id, deviceBefore, {...this}));
      this.eventManager?.triggerEvent(new EventLightOn(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventLightToggle(this.id, deviceBefore, true));
    }
  }

  protected abstract executeSetOn(): Promise<void>;

  async setOff(execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.on = false;
    if (execute) {
      await this.executeSetOff();
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventLightStatusChanged(this.id, deviceBefore, {...this}));
      this.eventManager?.triggerEvent(new EventLightOff(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventLightToggle(this.id, deviceBefore, false));
    }
  }

  protected abstract executeSetOff(): Promise<void>;

  override toDatabaseJson(): Record<string, unknown> {
    return { ...super.toDatabaseJson(), o: this.on ? 1 : 0 };
  }

  async toggle(execute: boolean, trigger: boolean = true) {
    if (this.on) {
       await this.setOff(execute, trigger);
    } else {
       await this.setOn(execute, trigger);
    }
  }
}
