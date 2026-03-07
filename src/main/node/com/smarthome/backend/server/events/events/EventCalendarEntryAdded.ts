import { DeviceCalendarEntry } from "../../../model/devices/DeviceCalendar.js";
import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventCalendarEntryAdded extends Event{
    constructor(deviceId: string, entry: DeviceCalendarEntry, eventId: string = crypto.randomUUID()) {
        const resultCondition:EventCondition = {
            id: 0,
            name: "entry",
            type: "obj",
            value: entry
        };
        super(eventId, deviceId, Date.now(), EventType.CALENDAR_ENTRY_ADDED, [], [], [resultCondition]);
    }

    public matchesListener(listener: EventListener): boolean {
        return listener.deviceId === this.deviceId;
    }
}