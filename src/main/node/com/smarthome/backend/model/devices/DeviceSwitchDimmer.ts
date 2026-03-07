import { DeviceSwitch } from "./DeviceSwitch.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventSwitchStatusChanged } from "../../server/events/events/EventSwitchStatusChanged.js";
import { EventSwitchDimmerBrightnessChanged } from "../../server/events/events/EventSwitchDimmerBrightnessChanged.js";

export abstract class DeviceSwitchDimmer extends DeviceSwitch {

  constructor(init?: Partial<DeviceSwitchDimmer>) {
    super();
    this.assignInit(init as any);
    this.buttons ??= {};
    this.type = DeviceType.SWITCH_DIMMER;
  }


  async setIntensity(buttonId: string, intensity: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    const button = this.buttons?.[buttonId];
    if (!button) return;
    button.setIntensity(intensity);
    if (intensity > 0) {
      button.setOn(true);
    } else if (intensity === 0) {
      button.setOn(false);
    }
    if (execute) {
      await this.executeSetIntensity(buttonId, intensity);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSwitchStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSwitchDimmerBrightnessChanged(this.id, deviceBefore, buttonId, intensity));
    }
  }

  protected abstract executeSetIntensity(buttonId: string, intensity: number): Promise<void>;

  override async setLongPressed(buttonId: string, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    await super.setLongPressed(buttonId, execute, trigger);
    const button = this.buttons?.[buttonId];
    if (!button) return;
    const start = button.getInitialPressTime();
    const end = button.getLastPressTime();
    const duration = end - start;
    const brightness = Math.max(0, 1 - Math.trunc(duration / 4000));
    button.setIntensity(brightness);

    if (execute) {
      await this.executeSetIntensity(buttonId, brightness);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSwitchStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSwitchDimmerBrightnessChanged(this.id, deviceBefore, buttonId, brightness));
    }
  }
}
