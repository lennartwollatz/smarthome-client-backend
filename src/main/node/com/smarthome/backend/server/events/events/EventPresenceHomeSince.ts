import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventPresenceHomeSince extends Event {
  constructor(deviceId: string, deviceBefore: object, last_detect: string, eventId: string = crypto.randomUUID()) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "device",
      type: "obj",
      value: deviceBefore,
    };
    const resultCondition: EventCondition = {
      id: 0,
      name: "last_detect",
      type: "str",
      value: last_detect,
    };
    super(eventId, deviceId, Date.now(), EventType.PRESENCE_HOME_SINCE, [eventCondition], [], [resultCondition]);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
