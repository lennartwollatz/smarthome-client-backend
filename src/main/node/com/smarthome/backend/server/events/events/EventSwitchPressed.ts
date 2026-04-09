import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventSwitchPressed extends Event {
  constructor(
    deviceId: string,
    deviceBefore: object,
    buttonId: string,
    pressCount: number,
    eventId: string = crypto.randomUUID()
  ) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "device",
      type: "obj",
      value: deviceBefore
    };
    const resultConditions: EventCondition[] = [
      { id: 0, name: "buttonId", type: "str", value: buttonId },
      { id: 0, name: "pressCount", type: "num", value: pressCount }
    ];
    super(eventId, deviceId, Date.now(), EventType.SWITCH_PRESSED, [eventCondition], [], resultConditions, true);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
