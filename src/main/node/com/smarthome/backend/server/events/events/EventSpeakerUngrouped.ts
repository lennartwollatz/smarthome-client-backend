import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

/**
 * Wird ausgelöst, wenn ein Lautsprecher aus einer Gruppe gelöst wurde
 * ({@link DeviceSpeaker.groupedWith} leer).
 */
export class EventSpeakerUngrouped extends Event {
  constructor(
    deviceId: string,
    deviceBefore: object,
    deviceAfter: object,
    eventId: string = crypto.randomUUID()
  ) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "device",
      type: "obj",
      value: deviceBefore,
    };
    const resultGrouped: EventCondition = {
      id: 0,
      name: "groupedWith",
      type: "obj",
      value: [],
    };
    const resultDevice: EventCondition = {
      id: 1,
      name: "device",
      type: "obj",
      value: deviceAfter,
    };
    super(eventId, deviceId, Date.now(), EventType.SPEAKER_UNGROUPED, [eventCondition], [], [
      resultGrouped,
      resultDevice,
    ]);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
