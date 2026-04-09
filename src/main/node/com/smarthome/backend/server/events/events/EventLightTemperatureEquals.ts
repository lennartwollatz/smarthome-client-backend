import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventLightTemperatureEquals extends Event{
    constructor(deviceId: string, deviceBefore: object, temperature: number, eventId: string = crypto.randomUUID()) {
        const eventCondition:EventCondition = {
            id: 0,
            name: "device",
            type: "obj",
            value: deviceBefore
        };
        const resultCondition:EventCondition = {
            id: 0,
            name: "temperature",
            type: "num",
            value: temperature
        };
        super(eventId, deviceId, Date.now(), EventType.LIGHT_TEMPERATURE_EQUALS, [eventCondition], [], [resultCondition], false);
    }

    public matchesListener(listener: EventListener): boolean {
        return listener.deviceId === this.deviceId;
    }
}
