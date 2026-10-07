import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventVacuumWaterBoxEmpty extends Event {
  constructor(deviceId: string, deviceBefore: object, eventId: string = crypto.randomUUID()) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "device",
      type: "obj",
      value: deviceBefore
    };
    super(eventId, deviceId, Date.now(), EventType.VACUUM_WATER_BOX_EMPTY, [eventCondition], [], []);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
