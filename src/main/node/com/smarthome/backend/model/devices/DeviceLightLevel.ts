import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventLightLevelStatusChanged } from "../../server/events/events/EventLightLevelStatusChanged.js";
import { EventLightLevelDark } from "../../server/events/events/EventLightLevelDark.js";
import { EventLightLevelBright } from "../../server/events/events/EventLightLevelBright.js";
import { EventLightLevelLess } from "../../server/events/events/EventLightLevelLess.js";
import { EventLightLevelGreater } from "../../server/events/events/EventLightLevelGreater.js";

export abstract class DeviceLightLevel extends Device {
  lightLevel?: number;

  constructor(init?: Partial<DeviceLightLevel>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.LIGHT_LEVEL;
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
}
