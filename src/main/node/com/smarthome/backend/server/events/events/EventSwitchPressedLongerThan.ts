import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventSwitchPressedLongerThan extends Event {
  constructor(
    deviceId: string,
    deviceBefore: object,
    buttonId: string,
    durationMs: number,
    eventId: string = crypto.randomUUID()
  ) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "device",
      type: "obj",
      value: deviceBefore,
    };
    const resultConditions: EventCondition[] = [
      { id: 0, name: "buttonId", type: "str", value: buttonId },
      { id: 0, name: "durationMs", type: "num", value: durationMs },
    ];
    super(eventId, deviceId, Date.now(), EventType.SWITCH_PRESSED_LONGER_THAN, [eventCondition], [], resultConditions, false);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
