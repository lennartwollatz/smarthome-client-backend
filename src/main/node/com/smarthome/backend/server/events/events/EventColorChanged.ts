import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventColorChanged extends Event{
    constructor(deviceId: string, deviceBefore: object, colorX: number, colorY: number, eventId: string = crypto.randomUUID()) {
        const eventCondition:EventCondition = {
            id: 0,
            name: "device",
            type: "obj",
            value: deviceBefore
        };
        const resultCondition:EventCondition = {
            id: 0,
            name: "color",
            type: "obj",
            value: { x: colorX, y: colorY }
        };
        super(eventId, deviceId, Date.now(), EventType.COLOR_CHANGED, [eventCondition], [], [resultCondition]);
    }

    public matchesListener(listener: EventListener): boolean {
        return listener.deviceId === this.deviceId;
    }
}
