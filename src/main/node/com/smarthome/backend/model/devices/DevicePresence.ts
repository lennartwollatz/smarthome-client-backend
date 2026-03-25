import { Device } from "./Device.js";
import { DeviceType } from "./helper/DeviceType.js";
import { EventPresenceStatusChanged } from "../../server/events/events/EventPresenceStatusChanged.js";
import { EventPresenceHome } from "../../server/events/events/EventPresenceHome.js";
import { EventPresenceAway } from "../../server/events/events/EventPresenceAway.js";

export class DevicePresence extends Device {
  present: boolean = false;

  constructor(init?: Partial<DevicePresence>) {
    super();
    this.assignInit(init as any);
    this.type = DeviceType.PRESENCE;
  }

  setPresent(present: boolean, trigger: boolean = true): void {
    const deviceBefore = { ...this };
    this.present = present;
    if (trigger && this.eventManager) {
      this.eventManager.triggerEvent(new EventPresenceStatusChanged(this.id, deviceBefore, { ...this }));
      if (present) {
        this.eventManager.triggerEvent(new EventPresenceHome(this.id, deviceBefore));
      } else {
        this.eventManager.triggerEvent(new EventPresenceAway(this.id, deviceBefore));
      }
    }
  }
}
