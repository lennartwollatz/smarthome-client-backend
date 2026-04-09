import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventLightStatusChanged extends Event{
    constructor(deviceId: string, lightBefore: object, lightAfter: object, eventId: string = crypto.randomUUID()) {
        const eventCondition:EventCondition = {
            id: 0,
            name: "light",
            type: "obj",
            value: lightBefore
        };
        const resultCondition:EventCondition = {
            id: 0,
            name: "light",
            type: "obj",
            value: lightAfter
        };
        super(eventId, deviceId, Date.now(), EventType.LIGHT_STATUS_CHANGED, [eventCondition], [], [resultCondition], true);
    }

    public matchesListener(listener: EventListener): boolean {
        return listener.deviceId === this.deviceId;
    }
}
