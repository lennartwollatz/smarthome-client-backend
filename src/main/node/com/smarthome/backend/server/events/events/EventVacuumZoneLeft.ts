import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventVacuumZoneLeft extends Event {
  constructor(deviceId: string, deviceBefore: object, zoneId: string, eventId: string = crypto.randomUUID()) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "device",
      type: "obj",
      value: deviceBefore
    };
    const resultCondition: EventCondition = {
      id: 0,
      name: "zoneId",
      type: "str",
      value: zoneId
    };
    super(eventId, deviceId, Date.now(), EventType.VACUUM_ZONE_LEFT, [eventCondition], [], [resultCondition]);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
