import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventLightLevelDark extends Event{
    constructor(deviceId: string, deviceBefore: object, lightLevel: number, eventId: string = crypto.randomUUID()) {
        const eventCondition:EventCondition = {
            id: 0,
            name: "device",
            type: "obj",
            value: deviceBefore
        };
        const resultCondition:EventCondition = {
            id: 0,
            name: "lightLevel",
            type: "num",
            value: lightLevel
        };
        super(eventId, deviceId, Date.now(), EventType.LIGHT_LEVEL_DARK, [eventCondition], [], [resultCondition], false);
    }

    public matchesListener(listener: EventListener): boolean {
        return listener.deviceId === this.deviceId;
    }
}
