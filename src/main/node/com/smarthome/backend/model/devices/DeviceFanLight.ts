import { DeviceFan } from "./DeviceFan.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventLightOn } from "../../server/events/events/EventLightOn.js";
import { EventLightOff } from "../../server/events/events/EventLightOff.js";
import { EventLightToggle } from "../../server/events/events/EventLightToggle.js";
import { EventFanStatusChanged } from "../../server/events/events/EventFanStatusChanged.js";

export abstract class DeviceFanLight extends DeviceFan {
  lightOn?: boolean;

  constructor(init?: Partial<DeviceFanLight>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.FAN_LIGHT;
  }

  async setLightOn(execute: boolean, trigger: boolean = true) {
    let deviceBefore = { ...this };
    this.lightOn = true;

    if (execute) {
      await this.executeSetLightOn();
    }
    if( trigger ){
      this.eventManager?.triggerEvent(new EventFanStatusChanged(this.id, deviceBefore, {...this}));
      this.eventManager?.triggerEvent(new EventLightOn(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventLightToggle(this.id, deviceBefore, true));
    }
  }

  protected abstract executeSetLightOn(): Promise<void>;

  async setLightOff(execute: boolean, trigger: boolean = true) {
    let deviceBefore = { ...this };
    this.lightOn = false;

    if (execute) {
      await this.executeSetLightOff();
    }
    if( trigger ){
      this.eventManager?.triggerEvent(new EventFanStatusChanged(this.id, deviceBefore, {...this}));
      this.eventManager?.triggerEvent(new EventLightOff(this.id, deviceBefore));
      this.eventManager?.triggerEvent(new EventLightToggle(this.id, deviceBefore, false));
    }
  }

  protected abstract executeSetLightOff(): Promise<void>;
}

