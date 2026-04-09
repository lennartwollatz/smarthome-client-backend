import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventThermostatStateHeating extends Event {
  constructor(deviceId: string, deviceBefore: object, eventId: string = crypto.randomUUID()) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "device",
      type: "obj",
      value: deviceBefore
    };
    const resultCondition: EventCondition = {
      id: 0,
      name: "state",
      type: "str",
      value: "heating"
    };
    super(eventId, deviceId, Date.now(), EventType.THERMOSTAT_STATE_HEATING, [eventCondition], [], [resultCondition], true);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
