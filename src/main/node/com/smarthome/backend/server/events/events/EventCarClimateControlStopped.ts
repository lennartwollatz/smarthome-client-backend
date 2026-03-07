import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventCarClimateControlStopped extends Event{
    constructor(deviceId: string, carBefore: object, eventId: string = crypto.randomUUID()) {
        const eventCondition:EventCondition = {
            id: 0,
            name: "car",
            type: "obj",
            value: carBefore
        };
        const resultCondition:EventCondition = {
            id: 0,
            name: "climateControlState",
            type: "bool",
            value: false
        };
        super(eventId, deviceId, Date.now(), EventType.CAR_CLIMATE_CONTROL_STOPPED, [eventCondition], [], [resultCondition]);
    }

    public matchesListener(listener: EventListener): boolean {
        return listener.deviceId === this.deviceId;
    }
}
