import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventSubwooferPowerOn extends Event {
  constructor(
    deviceId: string,
    deviceBefore: object,
    subwooferName: string,
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
      name: "subwooferName",
      type: "str",
      value: subwooferName
    };
    super(eventId, deviceId, Date.now(), EventType.SUBWOOFER_POWER_ON, [eventCondition], [], [resultCondition]);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
