import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventPrecipitationProbabilityEquals extends Event {
  constructor(
    deviceId: string,
    deviceBefore: object,
    precipitationProbability: number,
    eventId: string = crypto.randomUUID()
  ) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "device",
      type: "obj",
      value: deviceBefore
    };
    const resultCondition: EventCondition = {
      id: 0,
      name: "precipitationProbability",
      type: "num",
      value: precipitationProbability
    };
    super(eventId, deviceId, Date.now(), EventType.PRECIPITATION_PROBABILITY_EQUALS, [eventCondition], [], [resultCondition], false);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
