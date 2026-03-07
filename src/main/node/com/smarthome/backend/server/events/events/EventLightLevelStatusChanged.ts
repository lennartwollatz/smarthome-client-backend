import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventLightLevelStatusChanged extends Event{
    constructor(deviceId: string, lightLevelBefore: object, lightLevelAfter: object, eventId: string = crypto.randomUUID()) {
        const eventCondition:EventCondition = {
            id: 0,
            name: "lightLevel",
            type: "obj",
            value: lightLevelBefore
        };
        const resultCondition:EventCondition = {
            id: 0,
            name: "lightLevel",
            type: "obj",
            value: lightLevelAfter
        };
        super(eventId, deviceId, Date.now(), EventType.LIGHT_LEVEL_STATUS_CHANGED, [eventCondition], [], [resultCondition]);
    }

    public matchesListener(listener: EventListener): boolean {
        return listener.deviceId === this.deviceId;
    }
}
