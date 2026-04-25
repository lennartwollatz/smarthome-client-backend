import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventActiveStatusChanged } from "../../server/events/events/EventActiveStatusChanged.js";
import { EventActive } from "../../server/events/events/EventActive.js";
import { EventActiveInactive } from "../../server/events/events/EventActiveInactive.js";
import { EventParameter } from "../../server/events/event-types/EventParameter.js";

export abstract class DeviceActive extends Device {
  active: boolean;

  constructor(init?: Partial<DeviceActive>) {
    super(init);
    this.active = init?.active ?? false;
    this.type = DeviceType.ACTIVE;
  }

  override toDatabaseJson(): Record<string, unknown> {
      return { ...super.toDatabaseJson(), a: this.active ? 1 : 0 };
  }

  isActive(): boolean {
    return this.active;
  }

  isInactive(): boolean {
    return !this.active;
  }

  async setActive(execute: boolean, trigger: boolean = true): Promise<void> {
    const deviceBefore = { ...this };
    this.active = true;
    if(execute) {
      await this.executeSetActive();
    }
    if (trigger && this.eventManager) {
      this.eventManager.triggerEvent(new EventActiveStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager.triggerEvent(new EventActive(this.id, deviceBefore));
    }
  }
  protected abstract executeSetActive(): Promise<void>;



  async setInactive(execute: boolean, trigger: boolean = true): Promise<void> {
    const deviceBefore = { ...this };
    this.active = false;
    if(execute) {
      await this.executeSetInactive();
    }
    if (trigger && this.eventManager) {
      this.eventManager.triggerEvent(new EventActiveStatusChanged(this.id, deviceBefore, { ...this }));
      this.eventManager.triggerEvent(new EventActiveInactive(this.id, deviceBefore));
    }
  }
  protected abstract executeSetInactive(): Promise<void>;


}
