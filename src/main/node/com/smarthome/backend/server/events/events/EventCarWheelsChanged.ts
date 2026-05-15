import type { DeviceCarWheels } from "../../../model/devices/DeviceCar.js";
import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventCarWheelsChanged extends Event {
  constructor(
    deviceId: string,
    carBefore: object,
    wheels: DeviceCarWheels,
    eventId: string = crypto.randomUUID()
  ) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "car",
      type: "obj",
      value: carBefore
    };
    const resultCondition: EventCondition = {
      id: 0,
      name: "wheels",
      type: "obj",
      value: wheels
    };
    super(
      eventId,
      deviceId,
      Date.now(),
      EventType.CAR_WHEELS_CHANGED,
      [eventCondition],
      [],
      [resultCondition],
      false
    );
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
