import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventSwitchBrightnessGreater extends Event {
  constructor(
    deviceId: string,
    deviceBefore: object,
    buttonId: string,
    intensity: number,
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
      { id: 0, name: "intensity", type: "num", value: intensity },
    ];
    super(eventId, deviceId, Date.now(), EventType.SWITCH_BRIGHTNESS_GREATER, [eventCondition], [], resultConditions);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
