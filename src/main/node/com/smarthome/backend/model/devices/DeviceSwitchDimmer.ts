import { DeviceSwitch } from "./DeviceSwitch.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventSwitchStatusChanged } from "../../server/events/events/EventSwitchStatusChanged.js";
import { EventSwitchBrightnessChanged } from "../../server/events/events/EventSwitchBrightnessChanged.js";
import { EventSwitchBrightnessEquals } from "../../server/events/events/EventSwitchBrightnessEquals.js";
import { EventSwitchBrightnessLess } from "../../server/events/events/EventSwitchBrightnessLess.js";
import { EventSwitchBrightnessGreater } from "../../server/events/events/EventSwitchBrightnessGreater.js";
import { EventSwitchLongPressed } from "../../server/events/events/EventSwitchLongPressed.js";
import { EventSwitchPressedLongerThan } from "../../server/events/events/EventSwitchPressedLongerThan.js";

export abstract class DeviceSwitchDimmer extends DeviceSwitch {

  constructor(init?: Partial<DeviceSwitchDimmer>) {
    super();
    this.assignInit(init as any);
    this.buttons ??= {};
    this.type = DeviceType.SWITCH_DIMMER;
  }

  isBrightnessEquals(buttonId: string, brightness: number): boolean {
    return (this.buttons?.[buttonId]?.getBrightness() ?? 0) === brightness;
  }
  isBrightnessLess(buttonId: string, brightness: number): boolean {
    return (this.buttons?.[buttonId]?.getBrightness() ?? 0) < brightness;
  }
  isBrightnessGreater(buttonId: string, brightness: number): boolean {
    return (this.buttons?.[buttonId]?.getBrightness() ?? 0) > brightness;
  }

  async setLongPressed(buttonId: string, execute: boolean, trigger: boolean) {
    const deviceBefore = { ...this };
    const button = this.buttons?.[buttonId];
    if (!button) return;

    const now = Date.now();
    button.setLastPressTime(now);
    const durationMs = now - button.getFirstPressTime();
    const reductionFactor = Math.min(1.0, durationMs / 5000.0);
    let brightness = Math.round(100.0 * (1.0 - reductionFactor));
    brightness = Math.max(0, Math.min(100, brightness));
    button.setFirstPressTime(now);
    button.setInitialPressTime(now);
    button.setPressCount(0);
    button.setBrightness(brightness);

    if (execute) {
      await this.executeSetBrightness(buttonId, brightness);
    }

    if(trigger){
      this.eventManager?.triggerEvent(new EventSwitchStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSwitchLongPressed(this.id, deviceBefore, buttonId));
      this.eventManager?.triggerEvent(new EventSwitchPressedLongerThan(this.id, deviceBefore, buttonId, durationMs));
    }
  }


  async setBrightness(buttonId: string, brightness: number, execute: boolean, trigger: boolean = true) {
    const deviceBefore = { ...this };
    const button = this.buttons?.[buttonId];
    if (!button) return;
    button.setBrightness(brightness);
    if (brightness > 0) {
      button.setOn(true);
    } else if (brightness === 0) {
      button.setOn(false);
    }
    if (execute) {
      await this.executeSetBrightness(buttonId, brightness);
    }
    if (trigger) {
      this.eventManager?.triggerEvent(new EventSwitchStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager?.triggerEvent(new EventSwitchBrightnessChanged(this.id, deviceBefore, buttonId, brightness));
      this.eventManager?.triggerEvent(new EventSwitchBrightnessEquals(this.id, deviceBefore, buttonId, brightness));
      this.eventManager?.triggerEvent(new EventSwitchBrightnessLess(this.id, deviceBefore, buttonId, brightness));
      this.eventManager?.triggerEvent(new EventSwitchBrightnessGreater(this.id, deviceBefore, buttonId, brightness));
    }
  }

  protected abstract executeSetBrightness(buttonId: string, brightness: number): Promise<void>;
}
