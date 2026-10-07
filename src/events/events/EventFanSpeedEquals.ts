import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventFanSpeedEquals extends Event{
    constructor(deviceId: string, fanBefore: object, speed: number, eventId: string = crypto.randomUUID()) {
        const eventCondition:EventCondition = {
            id: 0,
            name: "fan",
            type: "obj",
            value: fanBefore
        };
        const resultCondition:EventCondition = {
            id: 0,
            name: "speed",
            type: "num",
            value: speed
        };
        super(eventId, deviceId, Date.now(), EventType.FAN_SPEED_EQUALS, [eventCondition], [], [resultCondition]);
    }

    public matchesListener(listener: EventListener): boolean {
        return listener.deviceId === this.deviceId;
    }
}
