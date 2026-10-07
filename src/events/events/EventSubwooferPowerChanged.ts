import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventSubwooferPowerChanged extends Event {
  constructor(
    deviceId: string,
    deviceBefore: object,
    subwooferName: string,
    power: boolean,
    eventId: string = crypto.randomUUID()
  ) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "device",
      type: "obj",
      value: deviceBefore
    };
    const resultConditions: EventCondition[] = [
      { id: 0, name: "subwooferName", type: "str", value: subwooferName },
      { id: 0, name: "power", type: "bool", value: power }
    ];
    super(eventId, deviceId, Date.now(), EventType.SUBWOOFER_POWER_CHANGED, [eventCondition], [], resultConditions);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
