import { DeviceCalendarEntry } from "../../../model/devices/DeviceCalendar.js";
import { EventCondition } from "../event-types/EventCondition.js";
import { EventListener } from "../EventListener.js";
import { EventType } from "../event-types/EventType.js";
import { Event } from "./Event.js";
import crypto from "crypto";

export class EventCalendarEntryChangedAllDay extends Event{
    constructor(deviceId: string, entryBefore: DeviceCalendarEntry, allDay: boolean, eventId: string = crypto.randomUUID()) {
        const eventCondition:EventCondition = {
            id: 0,
            name: "entry",
            type: "obj",
            value: entryBefore
        };
        const resultCondition:EventCondition = {
            id: 0,
            name: "allDay",
            type: "bool",
            value: allDay
        };
        super(eventId, deviceId, Date.now(), EventType.CALENDAR_ENTRY_CHANGED_ALL_DAY, [eventCondition], [], [resultCondition]);
    }

    public matchesListener(listener: EventListener): boolean {
        return listener.deviceId === this.deviceId;
    }
}
