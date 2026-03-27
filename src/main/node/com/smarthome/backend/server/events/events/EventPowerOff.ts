import { EventCondition } from "../event-types/EventCondition.js";
import { EventResult } from "../event-types/EventResult.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";
import { EventListener } from "../EventListener.js";

export class EventPowerOff extends Event {
  constructor(deviceId: string, powerBefore: boolean, eventId: string = crypto.randomUUID()) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "power",
      type: "bool",
      value: powerBefore,
    };
    const eventResult: EventResult = {
      id: 0,
      name: "power",
      type: "bool",
      value: false,
    };
    super(eventId, deviceId, Date.now(), EventType.POWER_OFF, [eventCondition], [], [eventResult]);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
