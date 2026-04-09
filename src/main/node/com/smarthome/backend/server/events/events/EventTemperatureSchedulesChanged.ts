import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventTemperatureSchedulesChanged extends Event {
  constructor(
    deviceId: string,
    deviceBefore: object,
    temperatureSchedules: object[],
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
      name: "temperatureSchedules",
      type: "obj",
      value: temperatureSchedules
    };
    super(eventId, deviceId, Date.now(), EventType.TEMPERATURE_SCHEDULES_CHANGED, [eventCondition], [], [resultCondition], true);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
