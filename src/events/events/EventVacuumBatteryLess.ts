import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventVacuumBatteryLess extends Event {
  constructor(deviceId: string, deviceBefore: object, battery: number, eventId: string = crypto.randomUUID()) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "device",
      type: "obj",
      value: deviceBefore
    };
    const resultCondition: EventCondition = {
      id: 0,
      name: "battery",
      type: "num",
      value: battery
    };
    super(eventId, deviceId, Date.now(), EventType.VACUUM_BATTERY_LESS, [eventCondition], [], [resultCondition]);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
