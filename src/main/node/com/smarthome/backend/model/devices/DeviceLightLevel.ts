import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventLightLevelStatusChanged } from "../../server/events/events/EventLightLevelStatusChanged.js";
import { EventBrightnessChanged } from "../../server/events/events/EventBrightnessChanged.js";
import { EventBrightnessEquals } from "../../server/events/events/EventBrightnessEquals.js";
import { EventBrightnessLess } from "../../server/events/events/EventBrightnessLess.js";
import { EventBrightnessGreater } from "../../server/events/events/EventBrightnessGreater.js";

export abstract class DeviceLightLevel extends Device {
  lightLevel?: number;

  constructor(init?: Partial<DeviceLightLevel>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.LIGHT_LEVEL;
  }

  abstract updateValues(): Promise<void>;

  async setLightLevel(lightLevel: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    this.lightLevel = lightLevel;
    if (execute) {
      await this.executeSetLightLevel(lightLevel);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventLightLevelStatusChanged(this.id, deviceBefore, {...this}));
      this.eventManager?.triggerEvent(new EventBrightnessChanged(this.id, deviceBefore, lightLevel));
      this.eventManager?.triggerEvent(new EventBrightnessEquals(this.id, deviceBefore, lightLevel));
      this.eventManager?.triggerEvent(new EventBrightnessLess(this.id, deviceBefore, lightLevel));
      this.eventManager?.triggerEvent(new EventBrightnessGreater(this.id, deviceBefore, lightLevel));
    }
  }

  protected abstract executeSetLightLevel(lightLevel: number): Promise<void>;
}
