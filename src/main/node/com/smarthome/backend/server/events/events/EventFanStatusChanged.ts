import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventFanStatusChanged extends Event{
    constructor(deviceId: string, fanBefore: object, fanAfter: object, eventId: string = crypto.randomUUID()) {
        const eventCondition:EventCondition = {
            id: 0,
            name: "fan",
            type: "obj",
            value: fanBefore
        };
        const resultCondition:EventCondition = {
            id: 0,
            name: "fan",
            type: "obj",
            value: fanAfter
        };
        super(eventId, deviceId, Date.now(), EventType.FAN_STATUS_CHANGED, [eventCondition], [], [resultCondition], true);
    }

    public matchesListener(listener: EventListener): boolean {
        return listener.deviceId === this.deviceId;
    }
}
