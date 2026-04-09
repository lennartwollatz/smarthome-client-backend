import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventCarRangeLess extends Event {
  constructor(deviceId: string, carBefore: object, rangeKm: number, eventId: string = crypto.randomUUID()) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "car",
      type: "obj",
      value: carBefore,
    };
    const resultCondition: EventCondition = {
      id: 0,
      name: "rangeKm",
      type: "num",
      value: rangeKm,
    };
    super(eventId, deviceId, Date.now(), EventType.CAR_RANGE_LESS, [eventCondition], [], [resultCondition], false);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
