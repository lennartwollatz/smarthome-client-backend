import { DeviceLight } from "./DeviceLight.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventLightStatusChanged } from "../../events/events/EventLightStatusChanged.js";
import { EventBrightnessChanged } from "../../events/events/EventBrightnessChanged.js";
import { EventBrightnessEquals } from "../../events/events/EventBrightnessEquals.js";
import { EventBrightnessLess } from "../../events/events/EventBrightnessLess.js";
import { EventBrightnessGreater } from "../../events/events/EventBrightnessGreater.js";

export abstract class DeviceLightDimmer extends DeviceLight {
  brightness?: number;

  constructor(init?: Partial<DeviceLightDimmer>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.LIGHT_DIMMER;
  }

  async setBrightness(brightness: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.brightness = brightness;
    if (execute) {
      await this.executeSetBrightness(brightness);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventLightStatusChanged(this.id, deviceBefore, {...this}));
      this.eventManager?.triggerEvent(new EventBrightnessChanged(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessEquals(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessLess(this.id, deviceBefore, brightness));
      this.eventManager?.triggerEvent(new EventBrightnessGreater(this.id, deviceBefore, brightness));
    }
  }

  protected abstract executeSetBrightness(brightness: number): Promise<void>;
}
