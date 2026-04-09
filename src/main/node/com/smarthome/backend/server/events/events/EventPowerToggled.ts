import { EventCondition } from "../event-types/EventCondition.js";
import { EventResult } from "../event-types/EventResult.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";
import { EventListener } from "../EventListener.js";

export class EventPowerToggled extends Event{
    constructor(deviceId: string, powerAfter:boolean, eventId: string = crypto.randomUUID()) {
        const eventCondition:EventCondition = {
            id: 0,
            name: "power",
            type: "bool",
            value: !powerAfter
        };
        const eventResult:EventResult = {
            id: 0,
            name: "power",
            type: "bool",
            value: powerAfter
        };
        super(eventId, deviceId, Date.now(), EventType.POWER_TOGGLED, [eventCondition], [], [eventResult], true);
    }

    public matchesListener(listener: EventListener): boolean {
        return true;
    }
}