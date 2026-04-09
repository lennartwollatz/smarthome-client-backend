import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventVacuumCleaningModeWiperVacuum extends Event {
  constructor(deviceId: string, deviceBefore: object, cleaningMode: number, eventId: string = crypto.randomUUID()) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "device",
      type: "obj",
      value: deviceBefore
    };
    const resultCondition: EventCondition = {
      id: 0,
      name: "cleaningMode",
      type: "int",
      value: cleaningMode
    };
    super(eventId, deviceId, Date.now(), EventType.VACUUM_CLEANING_MODE_WIPER_VACUUM, [eventCondition], [], [resultCondition], true);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
