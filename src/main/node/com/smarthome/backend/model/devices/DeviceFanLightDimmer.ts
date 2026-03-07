import { DeviceType } from "./helper/DeviceType.js";
import { EventFanStatusChanged } from "../../server/events/events/EventFanStatusChanged.js";
import { EventBrightnessChanged } from "../../server/events/events/EventBrightnessChanged.js";
import { EventBrightnessEquals } from "../../server/events/events/EventBrightnessEquals.js";
import { EventBrightnessLess } from "../../server/events/events/EventBrightnessLess.js";
import { EventBrightnessGreater } from "../../server/events/events/EventBrightnessGreater.js";
import { DeviceFanLight } from "./DeviceFanLight.js";

export abstract class DeviceFanLightDimmer extends DeviceFanLight {
  lightBrightness?: number;

  constructor(init?: Partial<DeviceFanLightDimmer>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.FAN_LIGHT_DIMMER;
  }

  async setLightBrightness(brightness: number, execute: boolean, trigger: boolean = true) {
    let deviceBefore = { ...this };
    this.lightBrightness = brightness;

    if (execute) {
      await this.executeSetLightBrightness(brightness);
    }
    if( trigger ){
      this.eventManager?.triggerEvent(new EventFanStatusChanged(this.id, deviceBefore, {...this}));
      this.eventManager?.triggerEvent(new EventBrightnessChanged(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessEquals(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessLess(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessGreater(this.id, deviceBefore, brightness));
    }
  }

  protected abstract executeSetLightBrightness(brightness: number): void | Promise<void>;
}
