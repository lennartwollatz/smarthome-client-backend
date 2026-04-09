import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event, eventButtonIdMatchesListener } from "./Event.js";
import crypto from "crypto";

export class EventSwitchButtonOn extends Event {
  constructor(
    deviceId: string,
    deviceBefore: object,
    buttonId: string,
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
      name: "buttonId",
      type: "str",
      value: buttonId
    };
    super(eventId, deviceId, Date.now(), EventType.SWITCH_BUTTON_ON, [eventCondition], [], [resultCondition], true);
  }

  public matchesListener(listener: EventListener): boolean {
    if (listener.deviceId !== this.deviceId) return false;
    return eventButtonIdMatchesListener(this, listener);
  }
}
