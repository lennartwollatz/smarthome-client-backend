import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventVacuumCleanSequenceChanged extends Event {
  constructor(deviceId: string, deviceBefore: object, cleanSequence: string[], eventId: string = crypto.randomUUID()) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "device",
      type: "obj",
      value: deviceBefore
    };
    const resultCondition: EventCondition = {
      id: 0,
      name: "cleanSequence",
      type: "obj",
      value: cleanSequence
    };
    super(eventId, deviceId, Date.now(), EventType.VACUUM_CLEAN_SEQUENCE_CHANGED, [eventCondition], [], [resultCondition]);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
