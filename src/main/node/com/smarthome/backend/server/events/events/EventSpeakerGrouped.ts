import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

/**
 * Wird ausgelöst, wenn ein Lautsprecher mit anderen Lautsprechern gruppiert wurde
 * ({@link DeviceSpeaker.groupedWith} aktualisiert).
 */
export class EventSpeakerGrouped extends Event {
  constructor(
    deviceId: string,
    deviceBefore: object,
    groupedDeviceIds: string[],
    eventId: string = crypto.randomUUID()
  ) {
    const eventCondition: EventCondition = {
      id: 0,
      name: "device",
      type: "obj",
      value: deviceBefore,
    };
    const resultCondition: EventCondition = {
      id: 0,
      name: "groupedWith",
      type: "obj",
      value: groupedDeviceIds,
    };
    super(eventId, deviceId, Date.now(), EventType.SPEAKER_GROUPED, [eventCondition], [], [resultCondition]);
  }

  public matchesListener(listener: EventListener): boolean {
    return listener.deviceId === this.deviceId;
  }
}
